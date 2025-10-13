import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Module({})
export class QueueModule {
  static forRoot(options: { host: string; port: number }): DynamicModule {
    return {
      module: QueueModule,
      imports: [
        BullModule.forRoot({
          connection: {
            host: options.host,
            port: options.port,
          },
        }),
      ],
      exports: [BullModule],
    };
  }

  static forFeature(queueName: string): DynamicModule {
    return {
      module: QueueModule,
      imports: [BullModule.registerQueue({ name: queueName })],
      exports: [BullModule],
    };
  }
}
