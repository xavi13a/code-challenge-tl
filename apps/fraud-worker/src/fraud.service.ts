import { Injectable } from '@nestjs/common';

export type FraudEvaluation =
  | { decision: 'approve'; riskLevel: 'low' }
  | { decision: 'review'; riskLevel: 'high' }
  | { decision: 'reject'; riskLevel: 'high'; reason: string };

@Injectable()
export class FraudService {
  evaluate(amount: number): FraudEvaluation {
    if (amount >= 10000) {
      return {
        decision: 'reject',
        riskLevel: 'high',
        reason: 'Fraud engine failed for high-value payment'
      };
    }

    if (amount > 1000) {
      return { decision: 'review', riskLevel: 'high' };
    }

    return { decision: 'approve', riskLevel: 'low' };
  }
}
