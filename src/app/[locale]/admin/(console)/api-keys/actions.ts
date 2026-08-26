'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';

import {API_SCOPES, createApiKey} from '@/lib/api/keys';
import {requireUserForAction} from '@/lib/auth/guard';
import {db} from '@/lib/db';

/** Server actions behind the API-key screen. */

/** Payload accepted when creating a key. */
const createKeySchema = z.object({
  name: z.string().trim().min(1, 'Give the key a name.').max(60),
  scopes: z.array(z.enum(API_SCOPES)).min(1, 'Grant at least one scope.'),
  /** Days until expiry; 0 or absent means the key never expires. */
  expiresInDays: z.number().int().min(0).max(3650).optional(),
});

/** What the screen receives back after creating a key. */
export type CreateKeyResult =
  {ok: true; key: string} | {ok: false; message: string};

/**
 * Creates an API key.
 *
 * The clear-text key is returned exactly once, here. Nothing stores it, so if
 * the operator loses it their only recourse is to revoke the key and create
 * another - which is the intended trade for not keeping a recoverable copy.
 *
 * @param input The creation form's payload.
 */
export async function createApiKeyAction(
  input: unknown,
): Promise<CreateKeyResult> {
  const user = await requireUserForAction();

  const parsed = createKeySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid input.',
    };
  }

  const {name, scopes, expiresInDays} = parsed.data;
  const expiresAt =
    expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  try {
    const created = await createApiKey(user.id, name, scopes, expiresAt);

    revalidatePath('/', 'layout');
    return {ok: true, key: created.key};
  } catch (error) {
    console.error('[admin] createApiKeyAction failed', error);
    return {ok: false, message: 'The key could not be created.'};
  }
}

/**
 * Revokes a key.
 *
 * Revocation is a timestamp rather than a delete, so the console can still
 * show that the key existed and when it was last used.
 *
 * @param id Identifier of the key.
 */
export async function revokeApiKeyAction(id: string): Promise<{ok: boolean}> {
  const user = await requireUserForAction();

  try {
    // Scoping the update to the owner stops one account revoking another's key.
    await db.apiKey.updateMany({
      where: {id, ownerId: user.id, revokedAt: null},
      data: {revokedAt: new Date()},
    });

    revalidatePath('/', 'layout');
    return {ok: true};
  } catch (error) {
    console.error('[admin] revokeApiKeyAction failed', error);
    return {ok: false};
  }
}
