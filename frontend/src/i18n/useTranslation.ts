import { useConsoleStore } from '../store/useConsoleStore';
import { translations } from './translations';

export const useTranslation = () => {
  const language = useConsoleStore((state) => state.language);
  
  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[language];
    for (const k of keys) {
      if (value && value[k] !== undefined) {
        value = value[k];
      } else {
        return key; // Fallback to key if missing
      }
    }
    return value as string;
  };

  return { t, language };
};
