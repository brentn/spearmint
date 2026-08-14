import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../data/database.service';
import { SimplefinApiService } from './simplefin-api.service';

/**
 * Backs the Connect-a-bank claim flow: exchanges a pasted setup token for an access URL
 * and stores it. Reused for adding further connections later, not one-time-only — a
 * user can claim multiple tokens over time, each becoming its own stored link that a
 * sync run walks independently (see SimplefinLink in data/models.ts).
 */
@Injectable({ providedIn: 'root' })
export class SimplefinLinkService {
  private readonly databaseService = inject(DatabaseService);
  private readonly api = inject(SimplefinApiService);

  async claim(setupToken: string): Promise<void> {
    const accessUrl = await this.api.claimSetupToken(setupToken);
    const db = await this.databaseService.getDatabase();
    await db.simplefinLinks.insert({
      id: crypto.randomUUID(),
      accessUrl,
      claimedAtUtc: new Date().toISOString(),
    });
  }

  async getAllAccessUrls(): Promise<string[]> {
    const db = await this.databaseService.getDatabase();
    const docs = await db.simplefinLinks.find().exec();
    return docs.map((doc) => doc.accessUrl);
  }
}
