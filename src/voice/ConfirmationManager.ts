import { PendingConfirmation } from './types';
import { UserLanguage, formatLocalizedResponse } from './LanguageUtils';

export class ConfirmationManager {
  public static isAffirmative(text: string): boolean {
    const t = text.toLowerCase().trim();
    // Checks English, Hinglish, and Hindi (Devanagari)
    const yesRegex = /\b(haan|ha|yes|yep|yeah|sure|kar\s+do|theek\s+hai|ok|okay|confirm|proceed|bilkul|haji)\b|हाँ|हां|कर\s*दो|हटा\s*दो|ठीक\s*है|ज़रूर|बिल्कुल|सही\s*है/i;
    return yesRegex.test(t);
  }

  public static isNegative(text: string): boolean {
    const t = text.toLowerCase().trim();
    const noRegex = /\b(nahi|na|no|nope|cancel|mat\s+karo|rehno\s+do|stop|dont|don't|never)\b|नहीं|ना|मत\s*करो|रहने\s*दो|कैंसिल/i;
    return noRegex.test(t);
  }

  public static formatConfirmationPrompt(
    confirmation: PendingConfirmation,
    lang: UserLanguage = 'hinglish'
  ): string {
    switch (confirmation.action) {
      case 'delete_transaction':
        return formatLocalizedResponse(lang, {
          hindi: `${confirmation.description} क्या मैं इसे हटा दूँ?`,
          hinglish: `${confirmation.description} Kya main ise delete karun?`,
          english: `${confirmation.description} Would you like me to delete it?`,
        });
      case 'delete_customer':
        return formatLocalizedResponse(lang, {
          hindi: `${confirmation.description} क्या आप सच में इस कस्टमर को हटाना चाहते हैं?`,
          hinglish: `${confirmation.description} Kya aap sach mein is customer ko delete karna chahte hain?`,
          english: `${confirmation.description} Are you sure you want to delete this customer?`,
        });
      case 'delete_reminder':
        return formatLocalizedResponse(lang, {
          hindi: `${confirmation.description} क्या मैं इस रिमाइंडर को हटा दूँ?`,
          hinglish: `${confirmation.description} Kya main ise delete karun?`,
          english: `${confirmation.description} Would you like me to remove this reminder?`,
        });
      default:
        return formatLocalizedResponse(lang, {
          hindi: `${confirmation.description} क्या आप पुष्टि करते हैं?`,
          hinglish: `${confirmation.description} Kya aap confirm karte hain?`,
          english: `${confirmation.description} Please confirm to proceed.`,
        });
    }
  }
}
