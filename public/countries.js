// [ISO code, name]. Used for the "where's home" suggestions and flag emoji.
export const COUNTRIES = `AF Afghanistan|AL Albania|DZ Algeria|AD Andorra|AO Angola|AG Antigua and Barbuda|AR Argentina|AM Armenia|AU Australia|AT Austria|AZ Azerbaijan|BS Bahamas|BH Bahrain|BD Bangladesh|BB Barbados|BY Belarus|BE Belgium|BZ Belize|BJ Benin|BT Bhutan|BO Bolivia|BA Bosnia and Herzegovina|BW Botswana|BR Brazil|BN Brunei|BG Bulgaria|BF Burkina Faso|BI Burundi|KH Cambodia|CM Cameroon|CA Canada|CV Cape Verde|CF Central African Republic|TD Chad|CL Chile|CN China|CO Colombia|KM Comoros|CG Congo|CD DR Congo|CR Costa Rica|CI Côte d'Ivoire|HR Croatia|CU Cuba|CY Cyprus|CZ Czechia|DK Denmark|DJ Djibouti|DM Dominica|DO Dominican Republic|EC Ecuador|EG Egypt|SV El Salvador|GQ Equatorial Guinea|ER Eritrea|EE Estonia|SZ Eswatini|ET Ethiopia|FJ Fiji|FI Finland|FR France|GA Gabon|GM Gambia|GE Georgia|DE Germany|GH Ghana|GR Greece|GD Grenada|GT Guatemala|GN Guinea|GW Guinea-Bissau|GY Guyana|HT Haiti|HN Honduras|HK Hong Kong|HU Hungary|IS Iceland|IN India|ID Indonesia|IR Iran|IQ Iraq|IE Ireland|IL Israel|IT Italy|JM Jamaica|JP Japan|JO Jordan|KZ Kazakhstan|KE Kenya|KI Kiribati|XK Kosovo|KW Kuwait|KG Kyrgyzstan|LA Laos|LV Latvia|LB Lebanon|LS Lesotho|LR Liberia|LY Libya|LI Liechtenstein|LT Lithuania|LU Luxembourg|MO Macau|MG Madagascar|MW Malawi|MY Malaysia|MV Maldives|ML Mali|MT Malta|MH Marshall Islands|MR Mauritania|MU Mauritius|MX Mexico|FM Micronesia|MD Moldova|MC Monaco|MN Mongolia|ME Montenegro|MA Morocco|MZ Mozambique|MM Myanmar|NA Namibia|NR Nauru|NP Nepal|NL Netherlands|NZ New Zealand|NI Nicaragua|NE Niger|NG Nigeria|KP North Korea|MK North Macedonia|NO Norway|OM Oman|PK Pakistan|PW Palau|PS Palestine|PA Panama|PG Papua New Guinea|PY Paraguay|PE Peru|PH Philippines|PL Poland|PT Portugal|PR Puerto Rico|QA Qatar|RO Romania|RU Russia|RW Rwanda|KN Saint Kitts and Nevis|LC Saint Lucia|VC Saint Vincent and the Grenadines|WS Samoa|SM San Marino|ST São Tomé and Príncipe|SA Saudi Arabia|SN Senegal|RS Serbia|SC Seychelles|SL Sierra Leone|SG Singapore|SK Slovakia|SI Slovenia|SB Solomon Islands|SO Somalia|ZA South Africa|KR South Korea|SS South Sudan|ES Spain|LK Sri Lanka|SD Sudan|SR Suriname|SE Sweden|CH Switzerland|SY Syria|TW Taiwan|TJ Tajikistan|TZ Tanzania|TH Thailand|TL Timor-Leste|TG Togo|TO Tonga|TT Trinidad and Tobago|TN Tunisia|TR Türkiye|TM Turkmenistan|TV Tuvalu|UG Uganda|UA Ukraine|AE United Arab Emirates|GB United Kingdom|US United States|UY Uruguay|UZ Uzbekistan|VU Vanuatu|VA Vatican City|VE Venezuela|VN Vietnam|YE Yemen|ZM Zambia|ZW Zimbabwe`
  .split("|")
  .map((s) => [s.slice(0, 2), s.slice(3)]);

const ALIASES = {
  uk: "GB", england: "GB", scotland: "GB", wales: "GB", britain: "GB", "great britain": "GB",
  usa: "US", "united states of america": "US", america: "US", us: "US",
  turkey: "TR", korea: "KR", "ivory coast": "CI", "cote d'ivoire": "CI", "czech republic": "CZ",
  holland: "NL", persia: "IR", burma: "MM", "cabo verde": "CV", uae: "AE", emirates: "AE", drc: "CD",
  swaziland: "SZ", "east timor": "TL", "sao tome and principe": "ST",
};

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const BY_NAME = new Map(COUNTRIES.map(([cc, name]) => [norm(name), cc]));

export function countryCode(input) {
  const n = norm(input || "");
  if (!n) return "";
  return BY_NAME.get(n) || ALIASES[n] || (/^[a-z]{2}$/.test(n) && COUNTRIES.some(([cc]) => cc === n.toUpperCase()) ? n.toUpperCase() : "");
}

export function flag(cc) {
  return cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : "";
}
