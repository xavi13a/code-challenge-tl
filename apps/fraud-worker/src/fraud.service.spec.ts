import { FraudService } from './fraud.service';

describe('FraudService', () => {
  const service = new FraudService();

  it('returns reject with reason for high-value payment', () => {
    const evaluation = service.evaluate(10000);

    expect(evaluation).toEqual({
      decision: 'reject',
      riskLevel: 'high',
      reason: 'Fraud engine failed for high-value payment'
    });
  });
});
