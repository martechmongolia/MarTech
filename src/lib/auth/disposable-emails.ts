/**
 * Blocklist of common disposable / temporary email providers. We reject
 * signups from these at the magic-link step so throwaway addresses can't
 * burn our email-send quota or claim free-tier credits.
 *
 * Curated from the public disposable-email-domains list (top ~200 most-seen
 * providers). Swap in the full npm package (`disposable-email-domains`) when
 * moderator workload justifies the larger list.
 */

const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  // 10minutemail family
  "10minutemail.com", "10minutemail.net", "10minutemail.org", "10minutemail.co.uk",
  "10minutesmail.com", "10minutemailbox.com", "10minutemail.de", "20minutemail.com",
  // Mailinator family
  "mailinator.com", "mailinator.net", "mailinator.org", "mailinator2.com", "mailinator7.com",
  "reallymymail.com", "mailinator.gq", "sogetthis.com", "spamherelots.com",
  // Guerrilla Mail family
  "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz",
  "guerrillamail.de", "guerrillamailblock.com", "grr.la", "sharklasers.com",
  "pokemail.net", "spam4.me",
  // Yopmail family
  "yopmail.com", "yopmail.net", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf",
  "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf",
  "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf", "hide.biz.st",
  // Temp-mail family
  "temp-mail.org", "temp-mail.io", "temp-mail.ru", "tempmail.com", "tempmail.net",
  "tempmail.us", "tempmail.plus", "tempail.com", "tempinbox.com", "temp-mail.de",
  "tempmailaddress.com", "tempmailer.com", "tmail.ws", "tmails.net", "tmpmail.net",
  "tmpmail.org", "tmpeml.info",
  // Throwaway / disposable brands
  "throwawaymail.com", "getairmail.com", "getnada.com", "nada.email", "dropmail.me",
  "fakeinbox.com", "fakemailgenerator.com", "maildrop.cc", "mailcatch.com",
  "mailnesia.com", "mailnull.com", "meltmail.com", "trashmail.com", "trashmail.net",
  "trashmail.ws", "trashymail.com", "trbvm.com", "my.safe-mail.net", "anonbox.net",
  "anonymbox.com", "deadaddress.com", "despam.it", "despammed.com", "dispostable.com",
  // Mohmal/Disposable Arabic services
  "mohmal.com", "mohmal.tech", "mohmal.in", "mohmal.im",
  // Emaildrop family
  "emaildrop.io", "emaillbox.net", "emailondeck.com", "emailtemporanea.net",
  "emailtemporario.com.br", "emailtemporario.net", "emailwarden.com",
  // Various throwaway services
  "spamgourmet.com", "spambog.com", "spambox.us", "spamfree24.com", "spamfree24.de",
  "spamfree24.eu", "spamfree24.info", "spamfree24.net", "spamfree24.org",
  "spamify.com", "spamhole.com", "spaml.com", "spaml.de", "spammotel.com",
  "spamobox.com", "spamtrail.com", "mt2014.com", "mt2015.com",
  // Other common ones
  "mytemp.email", "onewaymail.com",
  "rmqkr.net", "yopmail.xyz",
  // Fake-mail services
  "harakirimail.com", "mytrashmail.com", "tempemail.co",
  "tempe-mail.com", "tempe-mail.net", "tempemail.net", "tempemailaddress.com",
  "tempinbox.co.uk", "tempmailo.com", "tempmailbox.net", "tempmailer.de",
  "temporarioemail.com.br", "temporary-email.biz", "temporary-email.us",
  "temporary-mail.net", "temporaryemail.com", "temporaryemail.net",
  "temporaryforwarding.com", "temporaryinbox.com", "temporarymailaddress.com",
  // Short-term
  "burnermail.io", "burnerr.com", "burneremail.com", "burnermail.net",
  // Known spam / throwaway
  "bouncr.com", "cas.ms", "chacuo.net", "clrmail.com", "deadaddress.com",
  "dfgh.net", "dingbone.com", "dnd-zone.info", "dodsi.com", "easy-trash-mail.com",
  "evanfox.info", "eyepaste.com", "filzmail.com", "fizmail.com",
  "fleckens.hu", "fosil.pro", "fr33mail.info", "freundin.ru",
  "frapmail.com", "friendlymail.co.uk", "fuckedupload.com", "fudgerub.com",
  "fyii.de", "get2mail.fr", "getairmail.ga", "ghosttexter.de",
  "giantmail.de", "gishpuppy.com", "gmial.com", "gotti.otherinbox.com",
  "hacccc.com", "haltospam.com", "hatespam.org", "hmamail.com",
  "hochsitze.com", "hotpop.com", "hulapla.de", "ieatspam.eu", "ieatspam.info",
  "imailsc.info", "imgof.com", "imgv.de", "imstations.com",
  // Additional generic suspicious
  "x.loves.dicksinhisan.us", "deagot.com", "dumpmail.de", "duskmail.com",
  "e4ward.com", "edv.to", "ee1.pl", "ee2.pl", "einrot.com",
  "emailias.com", "emailmiser.com", "emailresort.com", "emailsensei.com",
  "emailspam.ch"
]);

const DOMAIN_RE = /^[^@]+@(.+)$/;

export function isDisposableEmail(email: string): boolean {
  const m = DOMAIN_RE.exec(email.trim().toLowerCase());
  if (!m) return false;
  const domain = m[1];
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

/** For telemetry / admin ops: get the blocked domain if any, else null. */
export function getDisposableDomain(email: string): string | null {
  const m = DOMAIN_RE.exec(email.trim().toLowerCase());
  if (!m) return null;
  const domain = m[1];
  if (!domain) return null;
  return DISPOSABLE_DOMAINS.has(domain) ? domain : null;
}
