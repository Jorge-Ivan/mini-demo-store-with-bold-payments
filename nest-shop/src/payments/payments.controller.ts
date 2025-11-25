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
  HttpException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import * as CryptoJS from 'crypto-js';
import * as crypto from 'crypto';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);
  private readonly boldSecretKey: string;
  private readonly isDebugEnabled: boolean;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    // Validar que la clave secreta esté configurada al inicializar el controlador
    this.boldSecretKey = this.configService.get<string>('BOLD_SECRET_KEY');
    if (!this.boldSecretKey || this.boldSecretKey.trim() === '') {
      throw new HttpException(
        'BOLD_SECRET_KEY environment variable is required but not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Solo habilitar debug si se configura explícitamente
    this.isDebugEnabled = process.env.DEBUG_WEBHOOK === 'true';
  }

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
        rawBody = req.rawBody.toString('utf-8');
      } else {
        console.error(
          'rawBody not available - ensure rawBody: true is set in main.ts',
        );
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Server configuration error',
        });
        return;
      }

      // Generar un ID único para esta request para tracking
      const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      this.logger.debug(`Webhook received`, {
        requestId,
        hasRawBody: !!req.rawBody,
        bodyLength: rawBody.length,
      });

      // Solo logear contenido sensible si DEBUG está habilitado explícitamente
      if (this.isDebugEnabled) {
        console.log('DEBUG - Raw body content:', rawBody);
      }

      // Usar la clave secreta ya validada en el constructor
      const secretKey = this.boldSecretKey;

      this.logger.debug(`Preparing signature verification`, {
        requestId,
        rawBodyLength: rawBody.length,
      });

      // Solo logear contenido raw si DEBUG está habilitado explícitamente
      if (this.isDebugEnabled) {
        console.log('DEBUG - Raw body for HMAC:', rawBody);
      }

      // Crear el hash HMAC SHA256 usando el raw body directamente
      const hashed = crypto
        .createHmac('sha256', secretKey)
        .update(rawBody)
        .digest('hex');

      this.logger.debug(`Signature verification in progress`, {
        requestId,
        hasReceivedSignature: !!receivedSignature,
        receivedSignatureLength: Buffer.from(receivedSignature || '').length,
        computedHashLength: Buffer.from(hashed).length,
      });

      // Solo logear signatures si DEBUG está habilitado explícitamente
      if (this.isDebugEnabled) {
        console.log(
          'DEBUG - Received signature length:',
          Buffer.from(receivedSignature || '').length,
        );
        console.log(
          'DEBUG - Computed hash length:',
          Buffer.from(hashed).length,
        );
      }

      // Verificar la firma de manera segura
      // Verify buffers have same length before timing-safe comparison
      const hashedBuffer = Buffer.from(hashed);
      const signatureBuffer = Buffer.from(receivedSignature || '');

      const isValidRequest =
        receivedSignature &&
        hashedBuffer.length === signatureBuffer.length &&
        crypto.timingSafeEqual(hashedBuffer, signatureBuffer);

      this.logger.debug(`Signature verification completed`, {
        requestId,
        isValid: isValidRequest,
      });

      if (!isValidRequest) {
        this.logger.warn(`Invalid webhook signature`, {
          requestId,
          reason: receivedSignature
            ? 'signature_mismatch'
            : 'missing_signature',
        });
        res.status(HttpStatus.UNAUTHORIZED).json({
          statusCode: HttpStatus.UNAUTHORIZED,
          message: 'Firma inválida',
        });
        return;
      }

      // Procesar el webhook
      this.logger.log(`Webhook processed successfully`, {
        requestId,
        dataReceived: !!req.body,
      });

      res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'ok',
        data: 'resultPaymentTransactions',
      });
    } catch (error) {
      this.logger.error(`Error processing webhook`, {
        error: error.message,
        stack: error.stack,
      });

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message || 'Error interno del servidor',
      });
    }
  }
}
