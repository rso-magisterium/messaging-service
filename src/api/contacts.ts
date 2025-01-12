import { Router } from "express";
import logger from "../logger";
import gqlClient from "../graphql/urql";
import { GetContactsDocument, GetContactsQuery, GetContactsQueryVariables } from "../graphql/generated/graphql";

const router = Router();

/**
 * @openapi
 * "/api/contacts/{tenantId}":
 *   get:
 *     summary: Get user contacts (within tenant)
 *     tags: [Contacts]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                 required: [id, name]
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 *       404:
 *         $ref: "#/components/responses/NotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.get("/:tenantId", async (req, res) => {
  const resp = await gqlClient
    .query<GetContactsQuery, GetContactsQueryVariables>(GetContactsDocument, { tenantId: req.params.tenantId })
    .toPromise();

  if (resp.error) {
    logger.error(
      { request: { path: req.originalUrl, params: req.params }, user: req.user, error: resp.error },
      "GraphQL request failed"
    );
    res.status(500).json({ message: "Server error", error: resp.error });
    return;
  }

  if (!resp.data) {
    logger.debug({ request: { path: req.originalUrl, params: req.params }, user: req.user }, "No data found");
    res.status(404).json({ message: "Tenant doesn't exist" });
    return;
  }

  if (resp.data.users.find((user) => user.id === req.user?.id) === undefined) {
    logger.debug(
      { request: { path: req.originalUrl, params: req.params }, user: req.user },
      "User is not a member of selected tenant"
    );
    res.status(403).json({ message: "User is not a member of selected tenant" });
  } else {
    logger.info({ request: { path: req.originalUrl }, user: req.user }, "Contacts retrieved");
    res.json(resp.data.users);
  }
});

export default router;
