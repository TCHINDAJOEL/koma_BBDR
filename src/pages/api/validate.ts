import type { NextApiRequest, NextApiResponse } from 'next';
import { validator } from '@/lib/validator';
import { ValidateRequest, ValidateResponse } from '@/types/schema';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ValidateResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, report: { timestamp: new Date().toISOString(), summary: { errors: 1, warnings: 0, infos: 0 }, alerts: [], levelA: [], levelB: [], levelC: [] } });
  }

  try {
    const { schema, data, rules } = req.body as ValidateRequest;

    const report = validator.validate(schema, data, rules);
    const valid = report.summary.errors === 0;

    res.status(200).json({ valid, report });
  } catch (error: any) {
    res.status(500).json({
      valid: false,
      report: {
        timestamp: new Date().toISOString(),
        summary: { errors: 1, warnings: 0, infos: 0 },
        alerts: [
          {
            severity: 'error',
            code: 'VALIDATION_ERROR',
            location: '/api/validate',
            message: error.message || 'Erreur lors de la validation',
          },
        ],
        levelA: [],
        levelB: [],
        levelC: [],
      },
    });
  }
}
