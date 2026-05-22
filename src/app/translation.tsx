import { createContext, useContext } from "react";
import { createTranslator, type Translator } from "../i18n";

export const TranslationContext = createContext<Translator>(createTranslator("en"));

export function useTranslation() {
  return useContext(TranslationContext);
}
