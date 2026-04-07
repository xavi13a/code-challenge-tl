import { BadRequestException } from '@nestjs/common';
import { PaymentsController } from '../src/payments/payments.controller';

describe('PaymentsController validation', () => {
  it('creates payment when body is valid', async () => {
    const service = {
      createPayment: jest.fn(async () => ({
        paymentId: '11111111-1111-1111-1111-111111111111',
        status: 'pending',
        consistency: {
          model: 'eventual',
          message: 'Payment accepted. Final status depends on downstream consumers.'
        }
      }))
    };

    const controller = new PaymentsController(service as never);

    const result = await controller.createPayment({
      countryCode: 'PE',
      amount: 120.5,
      currency: 'PEN'
    });

    expect(service.createPayment).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('pending');
  });

  it('returns 400 when countryCode length is invalid', async () => {
    const service = {
      createPayment: jest.fn()
    };

    const controller = new PaymentsController(service as never);

    try {
      await controller.createPayment({
        countryCode: 'PER',
        amount: 120.5,
        currency: 'PEN'
      });
      fail('Expected BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        statusCode: number;
        message: string[];
      };
      expect(response.statusCode).toBe(400);
      expect(response.message.join(' ')).toContain('countryCode');
      expect(service.createPayment).not.toHaveBeenCalled();
    }
  });

  it('returns 400 when amount is below minimum', async () => {
    const service = {
      createPayment: jest.fn()
    };

    const controller = new PaymentsController(service as never);

    try {
      await controller.createPayment({
        countryCode: 'PE',
        amount: 0,
        currency: 'PEN'
      });
      fail('Expected BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        statusCode: number;
        message: string[];
      };
      expect(response.statusCode).toBe(400);
      expect(response.message.join(' ')).toContain('amount');
      expect(service.createPayment).not.toHaveBeenCalled();
    }
  });
});
