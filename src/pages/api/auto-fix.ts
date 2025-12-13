import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '@/lib/storage';
import { ValidationAlert, TableData, Schema } from '@/types/schema';

interface AutoFixRequest {
    alert: ValidationAlert;
    fixType: 'single' | 'all';
}

interface AutoFixResponse {
    success: boolean;
    message: string;
    fixedCount?: number;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<AutoFixResponse>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const { alert, fixType } = req.body as AutoFixRequest;
        const state = await storage.loadState();

        let fixedCount = 0;
        let newData = { ...state.data };
        let newSchema = { ...state.schema };

        switch (alert.code) {
            case 'REQUIRED_FIELD_MISSING':
                // Appliquer la valeur par défaut aux champs requis manquants
                if (alert.context?.table && alert.context?.field && alert.quickFix?.value !== undefined) {
                    const tableName = alert.context.table;
                    const fieldName = alert.context.field;
                    const defaultValue = alert.quickFix.value;

                    newData[tableName] = (newData[tableName] || []).map((record: any) => {
                        if (record[fieldName] === undefined || record[fieldName] === null || record[fieldName] === '') {
                            fixedCount++;
                            return { ...record, [fieldName]: defaultValue };
                        }
                        return record;
                    });
                }
                break;

            case 'ENUM_VALUE_INVALID':
                // Remplacer les valeurs invalides par la première valeur enum valide
                if (alert.context?.table && alert.context?.field && alert.context?.allowedValues) {
                    const tableName = alert.context.table;
                    const fieldName = alert.context.field;
                    const validValue = alert.context.allowedValues[0];

                    newData[tableName] = (newData[tableName] || []).map((record: any) => {
                        if (record[fieldName] && !alert.context!.allowedValues!.includes(record[fieldName])) {
                            fixedCount++;
                            return { ...record, [fieldName]: validValue };
                        }
                        return record;
                    });
                }
                break;

            case 'TYPE_MISMATCH':
                // Convertir les valeurs au bon type
                if (alert.context?.table && alert.context?.field) {
                    const tableName = alert.context.table;
                    const fieldName = alert.context.field;
                    const table = state.schema.tables.find(t => t.name === tableName);
                    const field = table?.fields.find(f => f.name === fieldName);

                    if (field) {
                        newData[tableName] = (newData[tableName] || []).map((record: any) => {
                            const value = record[fieldName];
                            if (value !== null && value !== undefined) {
                                let converted = value;
                                try {
                                    if (field.type === 'number' || field.type === 'integer') {
                                        const num = Number(value);
                                        if (!isNaN(num)) {
                                            converted = field.type === 'integer' ? Math.floor(num) : num;
                                            fixedCount++;
                                        }
                                    } else if (field.type === 'boolean') {
                                        converted = Boolean(value);
                                        fixedCount++;
                                    } else if (field.type === 'string') {
                                        converted = String(value);
                                        fixedCount++;
                                    }
                                } catch {
                                    // Ignorer les erreurs de conversion
                                }
                                return { ...record, [fieldName]: converted };
                            }
                            return record;
                        });
                    }
                }
                break;

            case 'FOREIGN_KEY_VIOLATION':
                // Mettre la FK à null
                if (alert.context?.table && alert.context?.recordId && alert.context?.field) {
                    const tableName = alert.context.table;
                    const fieldName = alert.context.field;

                    newData[tableName] = (newData[tableName] || []).map((record: any) => {
                        if (record.id === alert.context!.recordId) {
                            fixedCount++;
                            return { ...record, [fieldName]: null };
                        }
                        return record;
                    });
                }
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: `Type de correction non supporté: ${alert.code}`
                });
        }

        // Sauvegarder les données modifiées
        if (fixedCount > 0) {
            await storage.saveData(newData);

            // Créer un événement d'audit
            const event = storage.createAuditEvent(
                'DATA_UPSERT',
                { type: 'record', ref: `auto-fix:${alert.code}` } as any,
                state.data,
                newData,
                `Auto-fix: ${alert.message}`
            );
            await storage.appendAuditEvent(event);
        }

        res.status(200).json({
            success: true,
            message: fixedCount > 0
                ? `${fixedCount} enregistrement(s) corrigé(s)`
                : 'Aucune correction nécessaire',
            fixedCount
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Erreur lors de la correction'
        });
    }
}
