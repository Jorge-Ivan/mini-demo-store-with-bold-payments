import {
  Controller,
  Post,
  Body,
  Headers,
  Get,
  Param,
  Req,
  Res,
  HttpStatus,
  RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import * as CryptoJS from 'crypto-js';
import * as crypto from 'crypto';

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

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('x-bold-signature') receivedSignature: string,
  ): Promise<void> {
    try {
      // Obtener el cuerpo crudo de la solicitud
      let rawBody: string;

      if (req.rawBody) {
        // Si tenemos rawBody disponible (configurado en main.ts)
        rawBody = req.rawBody.toString('utf-8');
      } else {
        // Fallback: usar el body parseado y convertirlo a string
        rawBody = JSON.stringify(req.body);
      }

      console.log('req.body ', rawBody);

      const secretKey = this.configService.get<string>('BOLD_SECRET_KEY') || '';

      // Codificar el cuerpo en base64
      const encodedBody = Buffer.from(rawBody).toString('base64');
      console.log('encoded ', encodedBody);

      // Crear el hash HMAC SHA256
      const hashed = crypto
        .createHmac('sha256', secretKey)
        .update(encodedBody)
        .digest('hex');

      console.log(
        'receivedSignature ',
        Buffer.from(receivedSignature || '').length,
      );
      console.log('hashed ', Buffer.from(hashed).length);

      // Verificar la firma de manera segura
      const isValidRequest =
        receivedSignature &&
        crypto.timingSafeEqual(
          Buffer.from(hashed),
          Buffer.from(receivedSignature),
        );

      console.log('is valid', isValidRequest);

      if (!isValidRequest) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          statusCode: HttpStatus.UNAUTHORIZED,
          message: 'Firma inválida',
        });
        return;
      }
      // Procesar el webhook (aquí solo se registra en consola)
      console.log('Webhook procesado exitosamente:', req.body);

      res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'ok',
        data: 'resultPaymentTransactions',
      });
    } catch (error) {
      console.error('Error procesando webhook:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message || 'Error interno del servidor',
      });
    }
  }
}
