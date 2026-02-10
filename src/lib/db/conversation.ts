import { PutCommand, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./dynamodb";
import type { ConversationSession, ChatMessage } from "@/types";

export async function createSession(
  userId: string,
  sessionId: string
): Promise<ConversationSession> {
  const session: ConversationSession = {
    sessionId,
    userId,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${userId}`,
        SK: `SESSION#${sessionId}`,
        ...session,
      },
    })
  );

  return session;
}

export async function getSession(
  userId: string,
  sessionId: string
): Promise<ConversationSession | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `SESSION#${sessionId}`,
      },
    })
  );

  if (!result.Item) return null;
  return result.Item as ConversationSession;
}

export async function addMessage(
  userId: string,
  sessionId: string,
  message: ChatMessage
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `SESSION#${sessionId}`,
      },
      UpdateExpression:
        "SET messages = list_append(if_not_exists(messages, :empty), :msg), updatedAt = :now",
      ExpressionAttributeValues: {
        ":msg": [message],
        ":empty": [],
        ":now": Date.now(),
      },
    })
  );
}

export async function getRecentSessions(
  userId: string,
  limit = 10
): Promise<ConversationSession[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":sk": "SESSION#",
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return (result.Items as ConversationSession[]) || [];
}
