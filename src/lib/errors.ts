export function serviceError(
  error: unknown,
  t: (en: string, ur: string) => string,
) {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, [string, string]> = {
    AI_NOT_CONFIGURED: [
      "Voice and image analysis is not connected yet. Add the Gemini key on the server, then restart the app.",
      "آواز اور تصویر کی سروس ابھی منسلک نہیں۔ سرور پر جیمنائی کی کلید شامل کرکے ایپ دوبارہ چلائیں۔",
    ],
    AI_RATE_LIMIT: [
      "The AI service is busy. Please wait and retry.",
      "اے آئی کی حد پوری ہو گئی۔ کچھ دیر بعد کوشش کریں۔",
    ],
    AI_REQUEST_FAILED: [
      "The AI request failed. Check the server key and selected model, then retry.",
      "اے آئی درخواست ناکام ہوئی۔ سرور کی کلید اور ماڈل دیکھ کر دوبارہ کوشش کریں۔",
    ],
    AI_AUTH_FAILED: [
      "The AI key was rejected or lacks access. Check the key/project permissions on the server.",
      "اے آئی کی کلید قبول نہیں ہوئی یا اجازت موجود نہیں۔ سرور پر کلید اور اجازت دیکھیں۔",
    ],
    AI_MODEL_UNAVAILABLE: [
      "No configured AI model is available. Please retry or check the project access.",
      "مقررہ اے آئی ماڈل دستیاب نہیں۔ دوبارہ کوشش کریں یا اجازت دیکھیں۔",
    ],
    AI_INPUT_REJECTED: [
      "This image could not be processed. Choose a clear prescription photo and retry.",
      "یہ تصویر پڑھی نہیں جا سکی۔ نسخے کی واضح تصویر منتخب کرکے دوبارہ کوشش کریں۔",
    ],
    AI_RESPONSE_INVALID: [
      "A complete reading could not be verified. Retake a clearer photo and retry.",
      "مکمل خواندگی کی جانچ نہیں ہو سکی۔ واضح تصویر دوبارہ لے کر کوشش کریں۔",
    ],
    SEARCH_RATE_LIMIT: [
      "Please wait a moment before searching again.",
      "دوبارہ تلاش کرنے سے پہلے ذرا انتظار کریں۔",
    ],
  };
  return messages[code]
    ? t(...messages[code])
    : t(
        "Unable to complete the request. Please retry.",
        "درخواست مکمل نہیں ہوئی۔ دوبارہ کوشش کریں۔",
      );
}
