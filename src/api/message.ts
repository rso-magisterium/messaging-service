import { Router } from "express";
import logger from "../logger";
import gqlClient from "../graphql/urql";
import prisma from "../prisma";
import {
  GetTenantWithUsersDocument,
  GetTenantWithUsersQuery,
  GetTenantWithUsersQueryVariables,
} from "../graphql/generated/graphql";

const router = Router();

/**
 * @openapi
 * "/api/message/{tenantId}/{contactId}":
 *   get:
 *     summary: Get messages between user and contact
 *     tags: [Message]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *       - in: path
 *         name: contactId
 *     responses:
 *       200:
 *         description: Messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   sender:
 *                     type: string
 *                   recipient:
 *                     type: string
 *                   content:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                 required: [id, sender, content, createdAt]
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 *       404:
 *         $ref: "#/components/responses/NotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.get("/:tenantId/:contactId", async (req, res) => {
  // Should not happen (user is authenticated)
  if (!req.user) return;

  // Check if user and contact are in the same tenant
  const resp = await gqlClient
    .query<
      GetTenantWithUsersQuery,
      GetTenantWithUsersQueryVariables
    >(GetTenantWithUsersDocument, { tenantId: req.params.tenantId, userIds: [req.user?.id, req.params.contactId] })
    .toPromise();

  if (resp.error) {
    logger.error(
      { request: { path: req.originalUrl, method: req.method, params: req.params }, user: req.user, error: resp.error },
      "GraphQL request failed"
    );
    res.status(500).json({ message: "Tenant doesn't exist" });
    return;
  }

  if (!resp.data) {
    logger.debug(
      { request: { path: req.originalUrl, method: req.method, params: req.params }, user: req.user },
      "No data found"
    );
    res.status(404).json({ message: "Tenant doesn't exist" });
    return;
  }

  if (resp.data.tenant?.users.length !== 2) {
    logger.info(
      { request: { path: req.originalUrl, method: req.method, params: req.params }, user: req.user },
      "User and contact are not in the same tenant"
    );
    res.status(403).json({ message: "User and contact are not in the same tenant" });
    return;
  }

  // Fetch messages
  const messages = await prisma.message.findMany({
    where: {
      tenant: req.params.tenantId,
      OR: [
        { sender: req.user.id, recipient: req.params.contactId },
        { sender: req.params.contactId, recipient: req.user.id },
      ],
    },
    select: { id: true, sender: true, recipient: true, content: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  logger.info(
    { request: { path: req.originalUrl, method: req.method }, user: req.user },
    `Messages retrieved for contact ${req.params.contactId}`
  );
  res.json(messages);
});

/**
 * @openapi
 * "/api/message/{tenantId}/{contactId}":
 *   post:
 *     summary: Send a message to contact
 *     tags: [Message]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *       - in: path
 *         name: contactId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *             required: [content]
 *     responses:
 *       200:
 *         description: "Message sent"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Response"
 *       "400":
 *         $ref: "#/components/responses/MissingParameters"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 *       404:
 *         $ref: "#/components/responses/NotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.post("/:tenantId/:contactId", async (req, res) => {
  // Should not happen (user is authenticated)
  if (!req.user) return;

  // Validate request body
  if (!req.body.content) {
    logger.debug(
      { request: { path: req.originalUrl, method: req.method }, user: req.user },
      "Missing required parameters"
    );
    res.status(400).json({ message: "Missing required parameters" });
    return;
  }

  // Check if user and contact are in the same tenant
  const resp = await gqlClient
    .query<
      GetTenantWithUsersQuery,
      GetTenantWithUsersQueryVariables
    >(GetTenantWithUsersDocument, { tenantId: req.params.tenantId, userIds: [req.user?.id, req.params.contactId] })
    .toPromise();

  if (resp.error) {
    logger.error(
      { request: { path: req.originalUrl, method: req.method, params: req.params }, user: req.user, error: resp.error },
      "GraphQL request failed"
    );
    res.status(500).json({ message: "Tenant doesn't exist" });
    return;
  }

  if (!resp.data) {
    logger.debug(
      { request: { path: req.originalUrl, method: req.method, params: req.params }, user: req.user },
      "No data found"
    );
    res.status(404).json({ message: "Tenant doesn't exist" });
    return;
  }

  if (resp.data.tenant?.users.length !== 2) {
    logger.info(
      { request: { path: req.originalUrl, method: req.method, params: req.params }, user: req.user },
      "User and contact are not in the same tenant"
    );
    res.status(403).json({ message: "User and contact are not in the same tenant" });
    return;
  }

  // Create message
  await prisma.message.create({
    data: {
      tenant: req.params.tenantId,
      sender: req.user.id,
      recipient: req.params.contactId,
      content: req.body.content,
    },
  });

  logger.info(
    { request: { path: req.originalUrl, method: req.method }, user: req.user },
    `Message sent to contact ${req.params.contactId}`
  );
  res.json({ message: "Message sent" });
});

export default router;
