import { PendingConfirmation } from './types';
import { UserLanguage, formatLocalizedResponse } from './LanguageUtils';

export class ConfirmationManager {
  public static isNegative(text: string): boolean {
    const t = text.toLowerCase().trim();
    const noRegex = /\b(nahi|na|nah|no|nope|cancel|mat\s+karo|mat\s+karna|rehno\s+do|rehne\s+do|stop|dont|don't|never|mat\s+hatao)\b|नहीं|ना|मत\s*करो|मत\s*करना|रहने\s*दो|कैंसिल|रोक\s*दो|मत\s*हटाओ/i;
    return noRegex.test(t);
  }

  public static isAffirmative(text: string): boolean {
    if (ConfirmationManager.isNegative(text)) return false;
    const t = text.toLowerCase().trim();
    // Handles affirmative phrases like "haan", "ha", "yes", "sure", "kar do", "karo", "jaldi karo", "delete", "hata do", "theek hai", "ok", "confirm"
    const yesRegex = /\b(haan|ha|haa|yes|yep|yeah|sure|kar\s*do|kardo|karo|karde|kar\s*de|theek\s*hai|theek|ok|okay|confirm|proceed|bilkul|haji|delete|hatao|hata\s*do|jaldi|sahi|achha|thik|go\s*ahead|do\s*it)\b|हाँ|हां|कर\s*दो|करदो|करो|हटा\s*दो|हटाओ|ठीक\s*है|ज़रूर|बिल्कुल|सही\s*है|डिलीट|डिलीट\s*करो|हटा\s*दीजिए|हाँ\s*हटा\s*दो/i;
    return yesRegex.test(t);
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
