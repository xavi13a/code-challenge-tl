export type PaymentStatusResponse = {
  paymentId: string;
  status: 'pending' | 'settled' | 'failed';
  fraudStatus: 'pending' | 'completed' | 'failed';
  ledgerStatus: 'pending' | 'completed' | 'failed';
  consistency: {
    model: 'eventual';
    message: string;
  };
};
