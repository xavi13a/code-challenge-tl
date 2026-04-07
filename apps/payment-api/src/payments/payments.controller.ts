import { BadRequestException, Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

@Controller('payments')
export class PaymentsController {
  constructor(
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService
  ) {}

  @Post()
  async createPayment(@Body() body: unknown) {
    const dto = await this.validateCreatePaymentDto(body);
    return this.paymentsService.createPayment(dto);
  }

  @Get(':id')
  async getPaymentStatus(@Param('id') id: string) {
    return this.paymentsService.getPaymentStatus(id);
  }

  private async validateCreatePaymentDto(body: unknown): Promise<CreatePaymentDto> {
    const dto = plainToInstance(CreatePaymentDto, body);

    const errors = await validate(dto, {
      whitelist: true
    });

    if (errors.length > 0) {
      throw new BadRequestException(this.toValidationMessages(errors));
    }

    return dto;
  }

  private toValidationMessages(errors: ValidationError[]): string[] {
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  }
}
