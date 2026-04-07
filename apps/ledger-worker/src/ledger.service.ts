import { Injectable } from '@nestjs/common';

@Injectable()
export class LedgerService {
  shouldFail(currency: string): boolean {
    return currency.toUpperCase() === 'ERR';
  }
}
