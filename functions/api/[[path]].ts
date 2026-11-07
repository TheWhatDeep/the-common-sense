import { handle } from '../../server/api';
import type { Env } from '../../server/http';

export const onRequest: PagesFunction<Env> = (context) => handle(context.request, context.env);
