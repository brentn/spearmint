import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../data/database.service';
import type { Category } from '../data/models';
import {
  type CategoryDraft,
  validateCategoryDelete,
  validateCategoryWrite,
} from './category-validation.util';

/** Category CRUD, gated by Peppermint's hierarchy validation rules (spec §1/§7). */
@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly databaseService = inject(DatabaseService);

  async list(): Promise<Category[]> {
    const db = await this.databaseService.getDatabase();
    const docs = await db.categories.find().exec();
    return docs.map((doc) => doc.toJSON());
  }

  async create(draft: CategoryDraft): Promise<Category> {
    const db = await this.databaseService.getDatabase();
    const categories = await this.list();
    const error = validateCategoryWrite(categories, draft);
    if (error) {
      throw new Error(error);
    }
    const category: Category = { id: crypto.randomUUID(), ...draft };
    await db.categories.insert(category);
    return category;
  }

  async update(id: string, draft: CategoryDraft): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const categories = await this.list();
    const error = validateCategoryWrite(categories, draft, id);
    if (error) {
      throw new Error(error);
    }
    const doc = await db.categories.findOne(id).exec();
    await doc?.incrementalPatch(draft);
  }

  async delete(id: string): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const categories = await this.list();
    const error = validateCategoryDelete(categories, id);
    if (error) {
      throw new Error(error);
    }
    const doc = await db.categories.findOne(id).exec();
    await doc?.remove();
  }
}
