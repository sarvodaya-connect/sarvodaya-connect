import { en } from "./messages/en";
import { createTranslator } from "./translate";

/** The fallback for code that has no language of its own yet, such as tests and later phases. */
export const ENGLISH = createTranslator(en, "en");
