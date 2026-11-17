export interface StatementRow {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
}

const MONTHS: Record<string, number> = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dic: 12,
};

// "17-oct-2026", "17/10/2026", "17 oct 2026" al inicio de la línea.
const LEADING_DATE =
  /^\s*(\d{1,2})[-/ ](\d{1,2}|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?[-/ ](\d{2,4})\s+/i;
const DATE_ANYWHERE =
  /\b\d{1,2}[-/ ](\d{1,2}|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?[-/ ]\d{2,4}\b/gi;
// Monto al final: "+ $1,234.56", "-$80.00", "1,234.56".
const TRAILING_AMOUNT = /([+-])?\s*\$?\s*(-)?(\d{1,3}(?:,\d{3})*\.\d{2})\s*$/;

/**
 * Saca los movimientos de un estado de cuenta: líneas que empiezan con fecha y
 * terminan con un monto. Los montos los extrae el código (nunca la IA) para que
 * no se puedan inventar. Las tablas de meses sin intereses (llevan "%") se omiten.
 * ponytail: heurística por línea; un banco con descripciones en varias líneas o
 * columnas de cargo/abono separadas necesitaría su propio caso.
 */
export function parseStatement(text: string): StatementRow[] {
  const rows: StatementRow[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (/\d%/.test(line)) continue;
    const d = line.match(LEADING_DATE);
    const a = line.match(TRAILING_AMOUNT);
    if (!d || !a) continue;

    const month = /^\d+$/.test(d[2])
      ? Number(d[2])
      : MONTHS[d[2].slice(0, 3).toLowerCase()];
    const year = d[3].length === 2 ? 2000 + Number(d[3]) : Number(d[3]);
    const day = Number(d[1]);
    if (!month || month > 12 || day > 31) continue;

    const description = line
      .slice(d[0].length, line.length - a[0].length)
      .replace(DATE_ANYWHERE, '') // segunda fecha (operación / cargo)
      .replace(/[;,]?\s*[A-Za-z ]*\*{2,}\d+/g, '') // "; Tarjeta Digital ***1234"
      .replace(/\s+/g, ' ')
      .trim();
    const amount = Number(a[3].replace(/,/g, ''));
    if (!description || !(amount > 0)) continue;

    rows.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      description,
      amount,
      type: a[1] === '-' || a[2] === '-' ? 'INCOME' : 'EXPENSE',
    });
  }
  return rows;
}

/** Comercios comunes en México: categoría sin preguntarle a la IA. */
export const KEYWORD_CATEGORIES: [RegExp, string][] = [
  [
    /uber ?eats|rappi|didi ?food|starbucks|restaur|taquer|tacos|pizza|burger|mcdonald|kfc|subway|domino|cafe|mariscos|sushi|cocina/i,
    'Comida',
  ],
  [
    /oxxo|7.?eleven|walmart|bodega aurrera|soriana|chedraui|\bheb\b|costco|sams|la comer|superama|city market/i,
    'Supermercado',
  ],
  [
    /uber|didi|cabify|autobus|ado\b|vivaaerobus|volaris|aeromexico|caseta|peaje|iave|televia/i,
    'Transporte',
  ],
  [/pemex|gasolin|bp\b|shell|mobil|oxxo gas|g500|repsol/i, 'Gasolina'],
  [
    /netflix|spotify|disney|hbo|prime video|youtube|apple\.com|icloud|google|openai|chatgpt|claude|xbox|playstation|crunchyroll/i,
    'Suscripciones',
  ],
  [
    /cfe|telmex|totalplay|izzi|megacable|telcel|at&t|movistar|bait|gas natural/i,
    'Servicios',
  ],
  [
    /farmacia|similares|benavides|del ahorro|hospital|medic|doctor|dental|laboratorio/i,
    'Salud',
  ],
  [
    /amazon|mercado ?pago|mercadolibre|shein|temu|aliexpress|liverpool\.com/i,
    'Compras en línea',
  ],
  [/cinepolis|cinemex|ticketmaster|steam|boletos/i, 'Entretenimiento'],
  [
    /liverpool|palacio de hierro|zara|h&m|c&a|coppel|suburbia|nike|adidas|cuidado con el perro/i,
    'Ropa',
  ],
  [/home depot|sodimac|ikea|elektra|best buy/i, 'Hogar'],
  [/interes|comision|iva |anualidad/i, 'Intereses y comisiones'],
];

/** Usa la categoría del usuario si ya tiene una con ese nombre (sin importar mayúsculas). */
export function matchUserCategory(name: string, userCategories: string[]) {
  return (
    userCategories.find((c) => c.toLowerCase() === name.toLowerCase()) ?? name
  );
}
