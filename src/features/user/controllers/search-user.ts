import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { Helpers } from '@global/helpers/helpers';
import { userService } from '@service/db/user.service';
import { ISearchUser } from '@user/interfaces/user.interface';
import { blockUserService } from '@service/db/block-user.service';

const PAGE_SIZE = 10;

class Search {
  public async user(req: Request, res: Response): Promise<void> {
    const { query, page } = req.params;
    const { userId } = req.currentUser!;

    // 1. Calculate Pagination 🧮
    const pageNumber = parseInt(page, 10) || 1;
    const skip = (pageNumber - 1) * PAGE_SIZE;
    const limit = PAGE_SIZE;

    // 2. Prepare Exclusion List 🚫
    const excludeIds: string[] = await blockUserService.getExclusionBlockIds(userId);
    excludeIds.push(userId);

    // 3. Call Service with Pagination params 🔍
    const users: ISearchUser[] = await userService.searchUsers(query, excludeIds, userId, skip, limit);

    res.status(HTTP_STATUS.OK).json({ message: 'Search results', users });
  }
}

export const search: Search = new Search();


