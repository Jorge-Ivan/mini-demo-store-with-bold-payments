import { Controller, Post, Body, Headers, Get, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import * as CryptoJS from 'crypto-js';

@Controller('payments')
export class PaymentsController {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  @Post('generate-hash')
  generateHash(@Body() body: any): any {
    const { orderId, amount, currency } = body;
    const secretKey = this.configService.get<string>('BOLD_SECRET_KEY');
    const data = `${orderId}${amount}${currency}${secretKey}`;
    const hash = CryptoJS.SHA256(data).toString();
    return { hash };
  }

  @Post('get-payment-link')
  async createPaymentLink(
    @Body() body: any,
    @Headers('referer') referer: string,
  ): Promise<any> {
    const url = this.configService.get<string>('BOLD_API_LINK_URL');
    const apiKey = this.configService.get<string>('BOLD_API_KEY');
    const headers = {
      Authorization: `x-api-key ${apiKey}`,
      'Content-Type': 'application/json',
    };
    const { orderId, amount, currency, expiration_date, callback_url } = body;
    const currentNanoseconds = Date.now() * 1e6; // Convertir milisegundos a nanosegundos
    const tenMinutesInNanoseconds = 10 * 60 * 1e9; // 10 minutos en nanosegundos
    const futureNanoseconds = currentNanoseconds + tenMinutesInNanoseconds;

    // Cuerpo de la solicitud
    const requestBody = {
      amount_type: amount ? 'CLOSE' : 'OPEN',
      amount: {
        currency: currency || 'COP',
        total_amount: amount || 0,
      },
      description: orderId || '',
      expiration_date: expiration_date || futureNanoseconds,
      callback_url: callback_url || referer || '',
    };

    try {
      const response = await this.httpService
        .post(url, requestBody, { headers })
        .toPromise();
      return response.data;
    } catch (error) {
      console.error(
        'Error al obtener el enlace de pago:',
        error.response?.data || error.message,
      );
      throw error.response?.data || error;
    }
  }

  @Get('get-payment-link/:payment_link')
  async getPaymentLink(
    @Param('payment_link') paymentLink: string,
  ): Promise<any> {
    const url =
      this.configService.get<string>('BOLD_API_LINK_URL') + '/' + paymentLink;
    const apiKey = this.configService.get<string>('BOLD_API_KEY');
    const headers = {
      Authorization: `x-api-key ${apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await this.httpService.get(url, { headers }).toPromise();
      return response.data;
    } catch (error) {
      console.error(
        'Error al obtener el enlace de pago:',
        error.response?.data || error.message,
      );
      throw error.response?.data || error;
    }
  }
}
