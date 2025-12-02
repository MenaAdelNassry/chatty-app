import { Request, Response } from 'express';
import { search } from '@user/controllers/search-user';
import { userService } from '@service/db/user.service';
import { authUserPayload, authMockRequest, authMockResponse } from '@root/mocks/auth.mock';
import { searchedUserMock } from '@root/mocks/user.mock'; // (هنعمله تحت لو مش عندك)
import HTTP_STATUS from 'http-status-codes';

jest.mock('@service/db/user.service');

describe('Search User Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call userService with correct Regex and return results', async () => {
    // Arrange
    const query = '  Manny  ';
    const req: Request = authMockRequest({}, {}, authUserPayload, { query }) as Request;
    const res: Response = authMockResponse();

    // Spy: السرفيس بترجع يوزر وهمي
    const serviceSpy = jest.spyOn(userService, 'searchUsers').mockResolvedValue([searchedUserMock]);

    // Act
    await search.user(req, res);

    // Assert

    expect(serviceSpy).toHaveBeenCalledWith(expect.any(RegExp));

    const calledRegex = serviceSpy.mock.calls[0][0];
    expect(calledRegex.source).toContain('Manny');
    expect(calledRegex.flags).toContain('i');

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Search results',
      results: [searchedUserMock]
    });
  });

  it('should return empty array if no user found', async () => {
    // Arrange
    const req: Request = authMockRequest({}, {}, authUserPayload, { query: 'Unknown' }) as Request;
    const res: Response = authMockResponse();

    jest.spyOn(userService, 'searchUsers').mockResolvedValue([]);

    // Act
    await search.user(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Search results',
      results: []
    });
  });
});
