// Common Indian brands â†’ active ingredients (salts). A safety net, not a formulary:
// unknown brands resolve to [] and the UI asks the family to type the salt themselves.
const BRANDS: Record<string, string[]> = {
  // Pain / fever
  dolo: ["paracetamol"], crocin: ["paracetamol"], calpol: ["paracetamol"], pacimol: ["paracetamol"],
  metacin: ["paracetamol"], "p 650": ["paracetamol"], combiflam: ["ibuprofen", "paracetamol"],
  brufen: ["ibuprofen"], "zerodol p": ["aceclofenac", "paracetamol"], zerodol: ["aceclofenac"],
  "hifenac p": ["aceclofenac", "paracetamol"], hifenac: ["aceclofenac"], voveran: ["diclofenac"],
  ultracet: ["tramadol", "paracetamol"], saridon: ["paracetamol", "propyphenazone", "caffeine"],
  disprin: ["aspirin"],
  // Blood pressure
  amlong: ["amlodipine"], amlokind: ["amlodipine"], stamlo: ["amlodipine"], amlopres: ["amlodipine"],
  amtas: ["amlodipine"], amlodac: ["amlodipine"],
  "amlopres at": ["amlodipine", "atenolol"], "amlokind at": ["amlodipine", "atenolol"],
  "stamlo beta": ["amlodipine", "atenolol"],
  telma: ["telmisartan"], telmikind: ["telmisartan"], telvas: ["telmisartan"],
  "telma am": ["telmisartan", "amlodipine"], "telmikind am": ["telmisartan", "amlodipine"],
  "telma h": ["telmisartan", "hydrochlorothiazide"], "telmikind h": ["telmisartan", "hydrochlorothiazide"],
  "telma ct": ["telmisartan", "chlorthalidone"],
  losar: ["losartan"], repace: ["losartan"], losacar: ["losartan"], covance: ["losartan"],
  "losar h": ["losartan", "hydrochlorothiazide"], "repace h": ["losartan", "hydrochlorothiazide"],
  olmezest: ["olmesartan"], aten: ["atenolol"], tenormin: ["atenolol"],
  "met xl": ["metoprolol"], metolar: ["metoprolol"], seloken: ["metoprolol"], "prolomet xl": ["metoprolol"],
  cilacar: ["cilnidipine"], nebicard: ["nebivolol"], nebistar: ["nebivolol"],
  cardace: ["ramipril"], ramistar: ["ramipril"], envas: ["enalapril"],
  aquazide: ["hydrochlorothiazide"], lasix: ["furosemide"], dytor: ["torsemide"], tide: ["torsemide"],
  aldactone: ["spironolactone"],
  // Diabetes
  glycomet: ["metformin"], glucophage: ["metformin"], gluformin: ["metformin"], glyciphage: ["metformin"],
  "glycomet gp": ["metformin", "glimepiride"], gemer: ["glimepiride", "metformin"],
  amaryl: ["glimepiride"], glimy: ["glimepiride"], glimestar: ["glimepiride"],
  "amaryl m": ["glimepiride", "metformin"], "glimestar m": ["glimepiride", "metformin"],
  diamicron: ["gliclazide"], glizid: ["gliclazide"], "glizid m": ["gliclazide", "metformin"],
  glynase: ["glipizide"], januvia: ["sitagliptin"], istavel: ["sitagliptin"],
  janumet: ["sitagliptin", "metformin"], galvus: ["vildagliptin"], jalra: ["vildagliptin"],
  "galvus met": ["vildagliptin", "metformin"], "jalra m": ["vildagliptin", "metformin"],
  ziten: ["teneligliptin"], forxiga: ["dapagliflozin"], jardiance: ["empagliflozin"],
  pioz: ["pioglitazone"], volix: ["voglibose"],
  // Cholesterol
  atorva: ["atorvastatin"], lipitor: ["atorvastatin"], storvas: ["atorvastatin"], tonact: ["atorvastatin"],
  atocor: ["atorvastatin"], rosuvas: ["rosuvastatin"], crestor: ["rosuvastatin"], rozavel: ["rosuvastatin"],
  rozat: ["rosuvastatin"], lipicard: ["fenofibrate"],
  // Blood thinners
  ecosprin: ["aspirin"], "ecosprin av": ["aspirin", "atorvastatin"],
  clopilet: ["clopidogrel"], plavix: ["clopidogrel"], deplatt: ["clopidogrel"], clopitab: ["clopidogrel"],
  "deplatt a": ["clopidogrel", "aspirin"], "clopitab a": ["clopidogrel", "aspirin"],
  warf: ["warfarin"], acitrom: ["acenocoumarol"], eliquis: ["apixaban"],
  // Heart
  sorbitrate: ["isosorbide dinitrate"], flavedon: ["trimetazidine"], lanoxin: ["digoxin"],
  // Thyroid
  thyronorm: ["levothyroxine"], eltroxin: ["levothyroxine"], thyrox: ["levothyroxine"],
  // Acidity
  pan: ["pantoprazole"], pantocid: ["pantoprazole"], pantop: ["pantoprazole"],
  "pan d": ["pantoprazole", "domperidone"], "pantocid dsr": ["pantoprazole", "domperidone"],
  omez: ["omeprazole"], "omez d": ["omeprazole", "domperidone"], rablet: ["rabeprazole"], razo: ["rabeprazole"],
  "rablet d": ["rabeprazole", "domperidone"], "razo d": ["rabeprazole", "domperidone"],
  nexpro: ["esomeprazole"], famocid: ["famotidine"], domstal: ["domperidone"],
  // Vitamins / bones
  shelcal: ["calcium carbonate", "cholecalciferol"], "uprise d": ["cholecalciferol"],
  calcirol: ["cholecalciferol"], methycobal: ["methylcobalamin"], osteofos: ["alendronate"],
  // Nerves / sleep / mood
  gabapin: ["gabapentin"], lyrica: ["pregabalin"], maxgalin: ["pregabalin"],
  alprax: ["alprazolam"], restyl: ["alprazolam"], clonotril: ["clonazepam"], rivotril: ["clonazepam"],
  lonazep: ["clonazepam"], zolfresh: ["zolpidem"], nexito: ["escitalopram"], daxid: ["sertraline"],
  serta: ["sertraline"], syndopa: ["levodopa", "carbidopa"],
  // Prostate
  urimax: ["tamsulosin"], veltam: ["tamsulosin"], "urimax d": ["tamsulosin", "dutasteride"], dutas: ["dutasteride"],
  // Breathing / allergy
  montair: ["montelukast"], "montair lc": ["montelukast", "levocetirizine"], "montek lc": ["montelukast", "levocetirizine"],
  cetzine: ["cetirizine"], okacet: ["cetirizine"], deriphyllin: ["etofylline", "theophylline"],
  asthalin: ["salbutamol"],
  // Antibiotics / stomach / gout
  azithral: ["azithromycin"], azee: ["azithromycin"], augmentin: ["amoxicillin", "clavulanic acid"],
  clavam: ["amoxicillin", "clavulanic acid"], "moxikind cv": ["amoxicillin", "clavulanic acid"],
  ciplox: ["ciprofloxacin"], emeset: ["ondansetron"], vomikind: ["ondansetron"], duphalac: ["lactulose"],
  zyloric: ["allopurinol"], febutaz: ["febuxostat"],
};

const compact = (s: string) => s.replace(/\s+/g, "");

const INDEX = new Map<string, string[]>(Object.entries(BRANDS).map(([k, v]) => [compact(k), v]));
for (const salt of new Set(Object.values(BRANDS).flat())) {
  if (!INDEX.has(compact(salt))) INDEX.set(compact(salt), [salt]);
}

/** Brand names for the form's suggestion list. */
export const BRAND_NAMES: string[] = Object.keys(BRANDS).map((k) => k.replace(/\b\w/g, (c) => c.toUpperCase()));

function words(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/\b(tab|tabs|tablet|tablets|cap|caps|capsule|capsules|syp|syrup|inj)\b\.?/g, " ")
    .replace(/\d+(\.\d+)?\s*(mg|mcg|ml|iu)?\b/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Active ingredients for a brand as typed ("TELMA-AM 40", "dolo650"); [] when unknown. */
export function resolveSalts(brand: string): string[] {
  const w = words(brand);
  // Longest leading run of whole words that names a brand, so "Glycomet GP 2 Forte" â†’ "glycomet gp".
  for (let n = w.length; n > 0; n--) {
    const hit = INDEX.get(w.slice(0, n).join(""));
    if (hit) return hit;
  }
  return [];
}

export interface SaltMed {
  id: string;
  brand: string;
  salts: string[];
  prescribed_by: string | null;
  prescribed_on: string | null;
}

export function findDuplicates<M extends SaltMed>(meds: M[]): { salt: string; meds: M[] }[] {
  const bySalt = new Map<string, M[]>();
  for (const m of meds) for (const s of new Set(m.salts)) bySalt.set(s, [...(bySalt.get(s) ?? []), m]);
  return [...bySalt].filter(([, ms]) => ms.length > 1).map(([salt, ms]) => ({ salt, meds: ms }));
}
