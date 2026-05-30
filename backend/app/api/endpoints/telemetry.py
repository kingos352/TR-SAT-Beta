from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
from datetime import datetime, timezone
import json
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.services.astrodynamics import propagate_state
from app.services.catalog_lookup import get_catalog_object_with_latest_tle

router = APIRouter()

@router.websocket("/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    print("[TR-SAT WS] connection attempt")
    await websocket.accept()
    print("[TR-SAT WS] accepted")
    
    try:
        # State for this socket session
        subscribed_ids = []
        cached_tles = {} # norad_id -> (name, line1, line2)
        rate_hz = 1.0
        status = "connected" # connected, paused, resumed, stopped
        
        async def safe_send(payload):
            try:
                await websocket.send_json(payload)
            except RuntimeError:
                raise WebSocketDisconnect()

        # Send initial status
        await safe_send({
            "type": "status",
            "status": "connected"
        })
        
        # Resolve DB session dynamically (supporting overrides for pytest)
        override = websocket.app.dependency_overrides.get(get_db)
        if override:
            db_res = override()
            if hasattr(db_res, "__next__") or hasattr(db_res, "__iter__"):
                db = next(iter(db_res))
            else:
                db = db_res
        else:
            db = SessionLocal()
            
        def refresh_cache(norad_ids):
            nonlocal cached_tles
            new_cache = {}
            missing_ids = []
            for norad_id in norad_ids:
                res = get_catalog_object_with_latest_tle(db, norad_id)
                if res:
                    rso, tle = res
                    new_cache[norad_id] = (rso.name, tle.line1, tle.line2)
                else:
                    missing_ids.append(norad_id)
            cached_tles = new_cache
            return missing_ids

        async def receiver():
            nonlocal subscribed_ids, rate_hz, status
            try:
                while True:
                    data = await websocket.receive_text()
                    print(f"[TR-SAT WS] received payload: {data}")
                    try:
                        payload = json.loads(data)
                        action = payload.get("action")
                        
                        if action in ("subscribe", "update"):
                            ids = payload.get("norad_ids", [])
                            if not isinstance(ids, list):
                                await safe_send({
                                    "type": "error",
                                    "message": "norad_ids must be a list of integers",
                                    "details": {}
                                })
                                continue
                                
                            # Ensure all elements are integers
                            try:
                                ids = [int(i) for i in ids]
                            except (ValueError, TypeError):
                                await safe_send({
                                    "type": "error",
                                    "message": "norad_ids must be a list of integers",
                                    "details": {}
                                })
                                continue
                                
                            if len(ids) > 20:
                                await safe_send({
                                    "type": "error",
                                    "message": "Maximum tracking selection limit is 20 objects.",
                                    "details": {"requested_count": len(ids)}
                                })
                                continue
                                
                            # Clamp rate_hz
                            req_rate = payload.get("rate_hz", rate_hz)
                            req_rate = max(1.0, min(60.0, float(req_rate)))
                                
                            rate_hz = req_rate
                            subscribed_ids = ids
                            
                            print(f"[TR-SAT WS] subscribe ids: {subscribed_ids}")
                            
                            # Refresh TLE cache
                            missing = refresh_cache(subscribed_ids)
                            
                            errors = []
                            if missing:
                                errors = [f"No TLE found in local catalog for NORAD ID {mid}" for mid in missing]
                                
                            status = "resumed" if action == "update" else "connected"
                            
                            await safe_send({
                                "type": "status",
                                "status": "connected" if action == "subscribe" else "resumed"
                            })
                            
                            # If there were missing TLEs, send an error frame
                            if errors:
                                await safe_send({
                                    "type": "error",
                                    "message": "Some requested objects were missing from local cache",
                                    "details": {"missing_ids": missing}
                                })
                                
                        elif action == "pause":
                            status = "paused"
                            await safe_send({
                                "type": "status",
                                "status": "paused"
                            })
                        elif action == "resume":
                            status = "resumed"
                            await safe_send({
                                "type": "status",
                                "status": "resumed"
                            })
                        elif action == "stop":
                            status = "stopped"
                            subscribed_ids = []
                            cached_tles = {}
                            await safe_send({
                                "type": "status",
                                "status": "stopped"
                            })
                        else:
                            await safe_send({
                                "type": "error",
                                "message": f"Unknown action: {action}",
                                "details": {}
                            })
                    except json.JSONDecodeError:
                        await safe_send({
                            "type": "error",
                            "message": "Malformed JSON payload",
                            "details": {}
                        })
                    except Exception as e:
                        await safe_send({
                            "type": "error",
                            "message": f"Internal receiver error: {str(e)}",
                            "details": {}
                        })
            except WebSocketDisconnect:
                raise
            except Exception as e:
                print(f"[TR-SAT WS] error inside receiver: {repr(e)}")
                raise

        async def sender():
            nonlocal subscribed_ids, rate_hz, status
            try:
                while True:
                    # Calculate sleep interval
                    interval = 1.0 / rate_hz if rate_hz > 0.0 else 1.0
                    await asyncio.sleep(interval)

                    if status in ("connected", "resumed") and subscribed_ids:
                        now = datetime.now(timezone.utc)

                        # Propagate all tracked objects concurrently in thread-pool workers,
                        # releasing the async event loop during SGP4 computation.
                        async def _propagate_one(norad_id: int):
                            if norad_id not in cached_tles:
                                return norad_id, None, f"No TLE found in local catalog for NORAD ID {norad_id}"
                            name, line1, line2 = cached_tles[norad_id]
                            try:
                                state = await asyncio.to_thread(propagate_state, name, line1, line2, now)
                                return norad_id, state, None
                            except Exception as exc:
                                return norad_id, None, f"Propagation failed for NORAD ID {norad_id}: {exc}"

                        results = await asyncio.gather(*[_propagate_one(nid) for nid in subscribed_ids])

                        objects = []
                        errors = []
                        for norad_id, state, err in results:
                            if state is not None:
                                objects.append({
                                    "norad_id": norad_id,
                                    "name": state["name"],
                                    "timestamp_utc": state["timestamp_utc"].isoformat(),
                                    "latitude_deg": state["latitude_deg"],
                                    "longitude_deg": state["longitude_deg"],
                                    "altitude_km": state["altitude_km"],
                                    "ecef": state["ecef"],
                                    "tle_epoch_utc": state["tle_epoch_utc"].isoformat() if state["tle_epoch_utc"] else None,
                                    "tle_age_days": state["tle_age_days"],
                                    "reliability_status": state["reliability_status"]
                                })
                            elif err:
                                errors.append(err)

                        if not objects:
                            await safe_send({
                                "type": "error",
                                "message": "All selected objects failed to propagate or are missing TLEs.",
                                "details": {"requested_ids": subscribed_ids, "errors": errors}
                            })
                        else:
                            await safe_send({
                                "type": "telemetry_frame",
                                "timestamp_utc": now.isoformat(),
                                "rate_hz": rate_hz,
                                "objects": objects,
                                "errors": errors
                            })
                            print("[TR-SAT WS] telemetry frame sent")
            except WebSocketDisconnect:
                raise
            except Exception as e:
                print(f"[TR-SAT WS] error inside sender: {repr(e)}")
                raise

        # Run both concurrently
        try:
            await asyncio.gather(receiver(), sender())
        finally:
            if not override:
                db.close()
                
    except WebSocketDisconnect:
        print("[TR-SAT WS] disconnected")
    except Exception as exc:
        print("[TR-SAT WS] error:", repr(exc))
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(exc)
            })
        except Exception:
            pass
