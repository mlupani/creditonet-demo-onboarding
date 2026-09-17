This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## DNIs prefijados de la demo

Al consultar el DNI/CUIL en el paso de Identificación (`src/lib/mocks.ts`), estos documentos devuelven un caso hardcodeado con su propio camino de evaluación. Cualquier otro DNI no listado cae en el caso "Cliente nuevo" (DNI X).

| DNI | Camino | Qué prueba |
|---|---|---|
| `20111111` | Happy path | Motor pasa, sin deudas previas, oferta limpia |
| `20222222` | Rechazo | Situación BCRA 4, el motor rechaza con carencia de 30 días |
| `20333333` | Crédito interno | Cliente con préstamo propio vigente (CR-000102) para renovar |
| `20444444` | Crédito externo | Cliente con deuda en Tarjeta Naranja ($350.000) para cancelar |
| `20555555` | Ambos créditos | Crédito interno (CR-000215) + deuda con Santander ($300.000) |
| `40999999` (o cualquier otro) | Cliente nuevo | Sin historial previo; aplica el limitante de cliente nuevo |

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
