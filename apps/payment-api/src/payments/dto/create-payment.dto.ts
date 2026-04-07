import { IsISO4217CurrencyCode, IsNumber, IsString, Length, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsISO4217CurrencyCode()
  currency!: string;
}
