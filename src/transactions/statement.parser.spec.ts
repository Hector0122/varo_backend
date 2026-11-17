import { KEYWORD_CATEGORIES, parseStatement } from './statement.parser';

describe('parseStatement', () => {
  it('saca movimientos y omite resúmenes y meses sin intereses', () => {
    const text = [
      'Total cargos    $12,345.67',
      '05-nov-2025 COMPRA A MESES ; Tarjeta Digital ***1234 $9,000.00 $750.00 $300.00 3 de 12 0.00%',
      '17-oct-2026 18-oct-2026 OXXO LA PAZ + $123.50',
      '20-oct-2026 21-oct-2026 UBER *TRIP ; Tarjeta Digital ***1234 + $1,045.00',
      '25-oct-2026 25-oct-2026 PAGO SPEI - $12,000.00',
      '03/11/26 AMAZON MX 89.90',
    ].join('\n');

    expect(parseStatement(text)).toEqual([
      {
        date: '2026-10-17',
        description: 'OXXO LA PAZ',
        amount: 123.5,
        type: 'EXPENSE',
      },
      {
        date: '2026-10-20',
        description: 'UBER *TRIP',
        amount: 1045,
        type: 'EXPENSE',
      },
      {
        date: '2026-10-25',
        description: 'PAGO SPEI',
        amount: 12000,
        type: 'INCOME',
      },
      {
        date: '2026-11-03',
        description: 'AMAZON MX',
        amount: 89.9,
        type: 'EXPENSE',
      },
    ]);
  });

  it('categoriza comercios comunes por palabra clave', () => {
    const cat = (d: string) =>
      KEYWORD_CATEGORIES.find(([re]) => re.test(d))?.[1];
    expect(cat('UBER *TRIP')).toBe('Transporte');
    expect(cat('UBER EATS')).toBe('Comida');
    expect(cat('NETFLIX.COM')).toBe('Suscripciones');
    expect(cat('OXXO LA PAZ')).toBe('Supermercado');
    expect(cat('TIENDA RANDOM')).toBeUndefined();
  });
});
