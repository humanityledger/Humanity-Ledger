-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentiment" DOUBLE PRECISION NOT NULL,
    "bias" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sectorId" TEXT,
    "author" TEXT NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalTvl" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "volume24h" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "zScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldRegistryAudit" (
    "id" TEXT NOT NULL,
    "platformName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isVerifiedOnChain" BOOLEAN NOT NULL DEFAULT false,
    "smartContractRef" TEXT,
    "solvencyStatus" TEXT NOT NULL,
    "systemBridgeUrl" TEXT NOT NULL,
    "features" TEXT[],
    "supportedChains" TEXT[],

    CONSTRAINT "GoldRegistryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcosystemWarRoomData" (
    "id" TEXT NOT NULL,
    "chainName" TEXT NOT NULL,
    "chainSymbol" TEXT NOT NULL,
    "totalEntities" INTEGER NOT NULL DEFAULT 0,
    "tvl" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "volume24h" DOUBLE PRECISION NOT NULL DEFAULT 0.0,

    CONSTRAINT "EcosystemWarRoomData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "isPro" BOOLEAN NOT NULL DEFAULT false,
    "isZkVerified" BOOLEAN NOT NULL DEFAULT false,
    "tier" TEXT NOT NULL DEFAULT 'FREE',
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "goldTicketTokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "worldIdNullifierHash" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "language" TEXT NOT NULL DEFAULT 'en',
    "timeFormat" TEXT NOT NULL DEFAULT '24h',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "addressFormat" TEXT NOT NULL DEFAULT 'truncated',
    "showBalances" BOOLEAN NOT NULL DEFAULT true,
    "hiddenAssets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultTimeframe" TEXT NOT NULL DEFAULT '1W',
    "displayUnit" TEXT NOT NULL DEFAULT 'FIAT',
    "layoutDensity" TEXT NOT NULL DEFAULT 'compact',
    "hardwareAcceleration" BOOLEAN NOT NULL DEFAULT true,
    "gasPreset" TEXT NOT NULL DEFAULT 'STANDARD',
    "customRpcUrl" TEXT,
    "mevProtection" BOOLEAN NOT NULL DEFAULT false,
    "maxSlippage" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "testnetMode" BOOLEAN NOT NULL DEFAULT false,
    "inactivityLockMinutes" INTEGER NOT NULL DEFAULT 60,
    "autoDisconnectTimer" TEXT NOT NULL DEFAULT '1h',
    "stealthMode" BOOLEAN NOT NULL DEFAULT false,
    "requireSignForExports" BOOLEAN NOT NULL DEFAULT true,
    "allowAnalytics" BOOLEAN NOT NULL DEFAULT true,
    "extendedSettings" JSONB DEFAULT '{}',
    "emailAlerts" BOOLEAN NOT NULL DEFAULT false,
    "telegramAlerts" BOOLEAN NOT NULL DEFAULT false,
    "ledgerAlertThreshold" DOUBLE PRECISION NOT NULL DEFAULT 1000000,
    "soundEffects" BOOLEAN NOT NULL DEFAULT true,
    "chatName" TEXT NOT NULL DEFAULT 'Ledger User',
    "chatBio" TEXT NOT NULL DEFAULT '',
    "qrLabel" TEXT NOT NULL DEFAULT 'Scan My Wallet',
    "chatPinHash" TEXT,
    "enclavePinHash" TEXT,
    "enclaveOtpHash" TEXT,
    "enclaveOtpExpiresAt" TIMESTAMP(3),
    "enclaveOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "otpSentCount" INTEGER NOT NULL DEFAULT 0,
    "otpLastSentAt" TIMESTAMP(3),
    "enclaveClearanceToken" TEXT,
    "enclaveClearanceTs" TIMESTAMP(3),
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnReply" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnMention" BOOLEAN NOT NULL DEFAULT true,
    "clerkId" TEXT,
    "email" TEXT,
    "snxAccountId" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "creditsBalance" INTEGER NOT NULL DEFAULT 2500,
    "humanityScore" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HumanityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HumanityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'ledger',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthUser" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "username" TEXT,
    "passwordHash" TEXT,
    "walletAddress" TEXT,
    "encryptedMnemonic" TEXT,
    "walletSalt" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationCode" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "totpSecret" TEXT,
    "backupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastLoginAt" TIMESTAMP(3),
    "recoveryEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enclavePinHash" TEXT,
    "enclaveOtpHash" TEXT,
    "enclaveOtpExpiresAt" TIMESTAMP(3),
    "enclaveOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "otpSentCount" INTEGER NOT NULL DEFAULT 0,
    "otpLastSentAt" TIMESTAMP(3),
    "enclaveClearanceToken" TEXT,
    "enclaveClearanceTs" TIMESTAMP(3),

    CONSTRAINT "AuthUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'weekly',
    "subscribed" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribeToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchedWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL DEFAULT 'Anonymous Ledger',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "change24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pnl24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "activityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isLedger" BOOLEAN NOT NULL DEFAULT false,
    "isSmart" BOOLEAN NOT NULL DEFAULT false,
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "forensics" JSONB,
    "category" TEXT,
    "identityTier" TEXT,
    "lastCheck" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchedWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressBookEntry" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "ensName" TEXT,
    "label" TEXT,
    "notes" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "chainId" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddressBookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatContact" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "peer" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatContactRequest" (
    "id" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingChatMessage" (
    "id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangePosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "markPrice" DOUBLE PRECISION NOT NULL,
    "unrealizedPnl" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangePosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'multi',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "metric" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "pan" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanvasState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiweNonce" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiweNonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallRoom" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "hostAddress" TEXT NOT NULL,
    "moderatorAddress" TEXT NOT NULL,
    "isVideo" BOOLEAN NOT NULL DEFAULT true,
    "maxParticipants" INTEGER NOT NULL DEFAULT 20,
    "participants" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CallRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallRoomToken" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallRoomToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HumanityIdentity" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "walletType" TEXT NOT NULL DEFAULT 'EOA',
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3),
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "HumanityIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HumanitySession" (
    "sessionId" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "authenticationMethod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "securityContext" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "HumanitySession_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "totalDuration" TEXT NOT NULL,
    "badge" TEXT,
    "level" TEXT NOT NULL DEFAULT 'Beginner',

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademySubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "contentUrl" TEXT,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentoringMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentoringMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldenTicket" (
    "id" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "serialCode" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'GENESIS',
    "badgeColor" TEXT NOT NULL DEFAULT 'GOLD',
    "networkLaunchEligible" BOOLEAN NOT NULL DEFAULT true,
    "ticketNumber" SERIAL NOT NULL,
    "twitterHandle" TEXT,
    "signatureData" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoldenTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelItem" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "aiSummary" TEXT,
    "category" TEXT NOT NULL DEFAULT 'FINANCE',
    "priority" TEXT NOT NULL DEFAULT 'SOVEREIGN',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'crypto',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "veracityScore" INTEGER NOT NULL DEFAULT 0,
    "veracityAnalysis" TEXT,
    "isFake" BOOLEAN NOT NULL DEFAULT false,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "tokens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnChainEntity" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "category" TEXT,
    "isZkShielded" BOOLEAN NOT NULL DEFAULT false,
    "neo4jNodeId" TEXT,
    "totalVolumeUSD" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnChainEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityLabel" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "labelName" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeuralAgentConfig" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'OBSERVER',
    "maxSlippage" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "targetChains" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoTradeThreshold" DOUBLE PRECISION,
    "lastPingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NeuralAgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeLockVault" (
    "id" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "unlockDate" TIMESTAMP(3) NOT NULL,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LOCKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeLockVault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeadMansSwitch" (
    "id" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "inactivityPeriod" INTEGER NOT NULL,
    "lastPing" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "txHash" TEXT,

    CONSTRAINT "DeadMansSwitch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "guardianAddress" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyDonation" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "nullifier" TEXT NOT NULL,
    "commitment" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyDonation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerActivity" (
    "id" TEXT NOT NULL,
    "immutableId" TEXT,
    "walletAddress" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TRANSFER',
    "token" TEXT NOT NULL DEFAULT 'BTC',
    "amount" TEXT NOT NULL DEFAULT '0',
    "usdValue" TEXT NOT NULL DEFAULT '0',
    "valueBTC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "btcPriceAtTx" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "blockNumber" BIGINT,
    "blockHeight" INTEGER,
    "chain" TEXT NOT NULL DEFAULT 'BTC',
    "entityName" TEXT NOT NULL DEFAULT 'Unknown',
    "institutional" BOOLEAN NOT NULL DEFAULT false,
    "confirmed" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isZkVerified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LedgerActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BRCStandard" (
    "id" TEXT NOT NULL,
    "brcNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'Unknown',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "type" TEXT NOT NULL DEFAULT 'Standard',
    "created" TIMESTAMP(3),
    "updated" TIMESTAMP(3),
    "summary" TEXT,
    "content" TEXT,
    "githubUrl" TEXT,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BRCStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramAlert" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "minApy" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "evSignals" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "location" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "token" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identityHash" TEXT,
    "chainId" INTEGER NOT NULL DEFAULT 1,
    "value" TEXT,
    "tokenSymbol" TEXT,
    "blockNumber" BIGINT DEFAULT 0,
    "gasUsed" BIGINT DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialRecovery" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 3,
    "delayHours" INTEGER NOT NULL DEFAULT 48,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SocialRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRebalancerPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "executedAt" TIMESTAMP(3),
    "txHashes" TEXT[],
    "expectedPnl" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIRebalancerPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalLedgerEvent" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "amountUSD" DOUBLE PRECISION NOT NULL,
    "protocol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalLedgerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_audit_log" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "hmacSig" TEXT NOT NULL,
    "prevHash" TEXT NOT NULL,

    CONSTRAINT "system_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiPurchaseIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "ip" TEXT,
    "country" TEXT,
    "userAgent" TEXT,
    "isSuspiciousIp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiPurchaseIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KYCRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "applicantId" TEXT,
    "documentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KYCRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainTransaction" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "userId" TEXT,
    "blockNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SWAP',
    "fromChain" TEXT,
    "toChain" TEXT,
    "fromToken" TEXT,
    "toToken" TEXT,
    "fromAmount" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockchainTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "free" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "locked" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "source" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPrivacyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "logLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dataSharing" BOOLEAN NOT NULL DEFAULT true,
    "sessionAutoLogout" TEXT NOT NULL DEFAULT '1h',
    "ipWhitelist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "twoFAEnabled" BOOLEAN NOT NULL DEFAULT false,
    "systemVisibility" TEXT NOT NULL DEFAULT 'Public',
    "exportEncryption" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPrivacyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmicEntity" (
    "id" TEXT NOT NULL,
    "seedHash" TEXT NOT NULL,
    "ledgerEventId" TEXT,
    "tier" TEXT NOT NULL,
    "amountUSD" DOUBLE PRECISION NOT NULL,
    "chain" TEXT NOT NULL,
    "generatorType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DORMANT',
    "artMetadata" JSONB,
    "musicMetadata" JSONB,
    "biotechMetadata" JSONB,
    "worldSimMetadata" JSONB,
    "agentMetadata" JSONB,
    "contractAddress" TEXT,
    "hiveEnergyAtBirth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evolutionCount" INTEGER NOT NULL DEFAULT 0,
    "parentEntityId" TEXT,
    "beneficiaryAddr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CosmicEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "expiryMonth" INTEGER NOT NULL,
    "expiryYear" INTEGER NOT NULL,
    "cvv" TEXT NOT NULL,
    "cardStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamificationRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "currentTier" TEXT NOT NULL DEFAULT 'INITIATE',
    "achievements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastEventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#888888',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ForumTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumTopic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumPost" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "replyToId" TEXT,
    "isSolution" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT,
    "postId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "topicId" TEXT,
    "postId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumTelemetry" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumTelemetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaTelemetry" (
    "id" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "p95" DOUBLE PRECISION,
    "sampleSize" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment" TEXT NOT NULL DEFAULT 'production',

    CONSTRAINT "BetaTelemetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NPSSurvey" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "feedback" TEXT,
    "signature" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NPSSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletAnalytics" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "forensics" JSONB,
    "category" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'system',
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "actionUrl" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPassport" (
    "id" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "issuerAddress" TEXT,
    "payload" JSONB NOT NULL,
    "coreEntropy" TEXT,
    "txHash" TEXT,
    "chainId" INTEGER,
    "gs1Gtin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPassport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvenanceEvent" (
    "id" TEXT NOT NULL,
    "passportId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProvenanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZkNullifier" (
    "id" TEXT NOT NULL,
    "nullifierHash" TEXT NOT NULL,
    "proofId" TEXT,
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZkNullifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketProposal" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "outcomes" TEXT[] DEFAULT ARRAY['FOR', 'AGAINST', 'ABSTAIN']::TEXT[],
    "category" TEXT NOT NULL DEFAULT 'CORE',
    "creatorAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VOTING',
    "votesFor" INTEGER NOT NULL DEFAULT 0,
    "votesAgainst" INTEGER NOT NULL DEFAULT 0,
    "votingThreshold" INTEGER NOT NULL DEFAULT 100,
    "votingEndsAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalVote" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "voterAddress" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "nullifierHash" TEXT NOT NULL,
    "merkleRoot" TEXT NOT NULL,
    "proof" TEXT NOT NULL,
    "verificationLevel" TEXT NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMetrics" (
    "id" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "votescast" INTEGER NOT NULL DEFAULT 0,
    "proposalsMade" INTEGER NOT NULL DEFAULT 0,
    "reputation" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AztecQuest" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qdReward" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AztecQuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestClaim" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "identityHash" TEXT NOT NULL DEFAULT '',
    "ipHash" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'CLAIMED',
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slashedAt" TIMESTAMP(3),

    CONSTRAINT "QuestClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdTransaction" (
    "id" TEXT NOT NULL,
    "aztecAddress" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QdTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SovereignNode" (
    "id" TEXT NOT NULL,
    "aztecAddress" TEXT NOT NULL,
    "identityHash" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "stakedAmount" DOUBLE PRECISION NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlockAt" TIMESTAMP(3) NOT NULL,
    "lastYieldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "totalYieldPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "SovereignNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialVerification" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "twitterId" TEXT,
    "twitterFollow" BOOLEAN NOT NULL DEFAULT false,
    "youtubeId" TEXT,
    "youtubeFollow" BOOLEAN NOT NULL DEFAULT false,
    "telegramId" TEXT,
    "telegramFollow" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirdropClaim" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "txHash" TEXT,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AirdropClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationReport" (
    "id" TEXT NOT NULL,
    "reporterAddress" TEXT NOT NULL,
    "messageHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "ModerationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusUpdate" (
    "id" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "emoji" TEXT,
    "privacy" TEXT NOT NULL DEFAULT 'contacts',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "ownerAddress" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityMember" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QDCreditLedger" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "direction" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "counterparty" TEXT,
    "txRef" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "rail" TEXT NOT NULL DEFAULT 'internal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QDCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "channelId" TEXT,
    "authorAddress" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "contentHtml" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginGeoEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "ipHash" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'XX',
    "countryName" TEXT NOT NULL DEFAULT 'Unknown',
    "region" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "asn" TEXT,
    "sessionType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "authMethod" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "deviceType" TEXT,
    "wasSuccessful" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginGeoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityChannel" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "price" DOUBLE PRECISION,
    "currency" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPermission" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "sendMessages" BOOLEAN NOT NULL DEFAULT true,
    "sendMedia" BOOLEAN NOT NULL DEFAULT true,
    "sendStickers" BOOLEAN NOT NULL DEFAULT true,
    "sendPolls" BOOLEAN NOT NULL DEFAULT true,
    "embedLinks" BOOLEAN NOT NULL DEFAULT true,
    "addUsers" BOOLEAN NOT NULL DEFAULT false,
    "pinMessages" BOOLEAN NOT NULL DEFAULT false,
    "changeInfo" BOOLEAN NOT NULL DEFAULT false,
    "slowModeSeconds" INTEGER NOT NULL DEFAULT 0,
    "antiSpam" BOOLEAN NOT NULL DEFAULT false,
    "requireApproval" BOOLEAN NOT NULL DEFAULT false,
    "postApproval" BOOLEAN NOT NULL DEFAULT false,
    "notifyNewMember" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CommunityPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "authorAddress" TEXT NOT NULL,
    "contentUrl" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TopicTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TopicTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Article_category_publishedAt_idx" ON "Article"("category", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Article_bias_sentiment_idx" ON "Article"("bias", "sentiment");

-- CreateIndex
CREATE INDEX "Article_sectorId_publishedAt_idx" ON "Article"("sectorId", "publishedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Sector_slug_key" ON "Sector"("slug");

-- CreateIndex
CREATE INDEX "Sector_zScore_idx" ON "Sector"("zScore" DESC);

-- CreateIndex
CREATE INDEX "Sector_totalTvl_idx" ON "Sector"("totalTvl" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GoldRegistryAudit_slug_key" ON "GoldRegistryAudit"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EcosystemWarRoomData_chainName_key" ON "EcosystemWarRoomData"("chainName");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_worldIdNullifierHash_key" ON "User"("worldIdNullifierHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_snxAccountId_key" ON "User"("snxAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "User_tier_lastActive_idx" ON "User"("tier", "lastActive" DESC);

-- CreateIndex
CREATE INDEX "User_isPro_createdAt_idx" ON "User"("isPro", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "CreditLedger_userId_timestamp_idx" ON "CreditLedger"("userId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "HumanityEvent_userId_timestamp_idx" ON "HumanityEvent"("userId", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_userId_isActive_idx" ON "ApiKey"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_email_key" ON "AuthUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_username_key" ON "AuthUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_walletAddress_key" ON "AuthUser"("walletAddress");

-- CreateIndex
CREATE INDEX "AuthUser_email_idx" ON "AuthUser"("email");

-- CreateIndex
CREATE INDEX "AuthUser_walletAddress_idx" ON "AuthUser"("walletAddress");

-- CreateIndex
CREATE INDEX "AuthUser_username_idx" ON "AuthUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSubscriber_email_key" ON "EmailSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSubscriber_unsubscribeToken_key" ON "EmailSubscriber"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "EmailSubscriber_subscribed_idx" ON "EmailSubscriber"("subscribed");

-- CreateIndex
CREATE INDEX "EmailSubscriber_createdAt_idx" ON "EmailSubscriber"("createdAt");

-- CreateIndex
CREATE INDEX "WatchedWallet_userId_createdAt_idx" ON "WatchedWallet"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WatchedWallet_address_idx" ON "WatchedWallet"("address");

-- CreateIndex
CREATE UNIQUE INDEX "WatchedWallet_userId_address_key" ON "WatchedWallet"("userId", "address");

-- CreateIndex
CREATE INDEX "AddressBookEntry_authUserId_idx" ON "AddressBookEntry"("authUserId");

-- CreateIndex
CREATE INDEX "AddressBookEntry_address_idx" ON "AddressBookEntry"("address");

-- CreateIndex
CREATE UNIQUE INDEX "AddressBookEntry_authUserId_address_key" ON "AddressBookEntry"("authUserId", "address");

-- CreateIndex
CREATE INDEX "ChatContact_owner_idx" ON "ChatContact"("owner");

-- CreateIndex
CREATE UNIQUE INDEX "ChatContact_owner_peer_key" ON "ChatContact"("owner", "peer");

-- CreateIndex
CREATE INDEX "ChatContactRequest_toAddress_status_idx" ON "ChatContactRequest"("toAddress", "status");

-- CreateIndex
CREATE INDEX "ChatContactRequest_fromAddress_status_idx" ON "ChatContactRequest"("fromAddress", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChatContactRequest_fromAddress_toAddress_key" ON "ChatContactRequest"("fromAddress", "toAddress");

-- CreateIndex
CREATE INDEX "PendingChatMessage_recipient_idx" ON "PendingChatMessage"("recipient");

-- CreateIndex
CREATE INDEX "PendingChatMessage_sender_idx" ON "PendingChatMessage"("sender");

-- CreateIndex
CREATE INDEX "ExchangePosition_userId_status_idx" ON "ExchangePosition"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_symbol_chain_key" ON "Watchlist"("userId", "symbol", "chain");

-- CreateIndex
CREATE UNIQUE INDEX "CanvasState_userId_key" ON "CanvasState"("userId");

-- CreateIndex
CREATE INDEX "CanvasState_lastSyncedAt_idx" ON "CanvasState"("lastSyncedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SiweNonce_nonce_key" ON "SiweNonce"("nonce");

-- CreateIndex
CREATE UNIQUE INDEX "CallRoom_roomId_key" ON "CallRoom"("roomId");

-- CreateIndex
CREATE INDEX "CallRoom_roomId_idx" ON "CallRoom"("roomId");

-- CreateIndex
CREATE INDEX "CallRoom_hostAddress_idx" ON "CallRoom"("hostAddress");

-- CreateIndex
CREATE INDEX "CallRoom_expiresAt_idx" ON "CallRoom"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CallRoomToken_token_key" ON "CallRoomToken"("token");

-- CreateIndex
CREATE INDEX "CallRoomToken_roomId_address_idx" ON "CallRoomToken"("roomId", "address");

-- CreateIndex
CREATE INDEX "CallRoomToken_token_idx" ON "CallRoomToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "HumanityIdentity_walletAddress_key" ON "HumanityIdentity"("walletAddress");

-- CreateIndex
CREATE INDEX "HumanitySession_identityId_idx" ON "HumanitySession"("identityId");

-- CreateIndex
CREATE INDEX "HumanitySession_expiresAt_idx" ON "HumanitySession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_lessonId_key" ON "UserProgress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "AcademySubmission_userId_lessonId_idx" ON "AcademySubmission"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "AcademySubmission_status_idx" ON "AcademySubmission"("status");

-- CreateIndex
CREATE INDEX "MentoringMessage_receiverId_read_idx" ON "MentoringMessage"("receiverId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "GoldenTicket_userAddress_key" ON "GoldenTicket"("userAddress");

-- CreateIndex
CREATE UNIQUE INDEX "GoldenTicket_serialCode_key" ON "GoldenTicket"("serialCode");

-- CreateIndex
CREATE INDEX "GoldenTicket_isActive_claimedAt_idx" ON "GoldenTicket"("isActive", "claimedAt" DESC);

-- CreateIndex
CREATE INDEX "GoldenTicket_tier_claimedAt_idx" ON "GoldenTicket"("tier", "claimedAt" DESC);

-- CreateIndex
CREATE INDEX "GoldenTicket_ticketNumber_idx" ON "GoldenTicket"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "IntelItem_url_key" ON "IntelItem"("url");

-- CreateIndex
CREATE INDEX "IntelItem_publishedAt_idx" ON "IntelItem"("publishedAt" DESC);

-- CreateIndex
CREATE INDEX "IntelItem_category_publishedAt_idx" ON "IntelItem"("category", "publishedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_externalId_key" ON "NewsArticle"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_url_key" ON "NewsArticle"("url");

-- CreateIndex
CREATE INDEX "NewsArticle_publishedAt_idx" ON "NewsArticle"("publishedAt" DESC);

-- CreateIndex
CREATE INDEX "NewsArticle_source_idx" ON "NewsArticle"("source");

-- CreateIndex
CREATE UNIQUE INDEX "OnChainEntity_address_key" ON "OnChainEntity"("address");

-- CreateIndex
CREATE UNIQUE INDEX "OnChainEntity_neo4jNodeId_key" ON "OnChainEntity"("neo4jNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NeuralAgentConfig_agentId_key" ON "NeuralAgentConfig"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeLockVault_userAddress_key" ON "TimeLockVault"("userAddress");

-- CreateIndex
CREATE UNIQUE INDEX "DeadMansSwitch_userAddress_key" ON "DeadMansSwitch"("userAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_userEmail_guardianAddress_key" ON "Guardian"("userEmail", "guardianAddress");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyDonation_nullifier_key" ON "PrivacyDonation"("nullifier");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyDonation_commitment_key" ON "PrivacyDonation"("commitment");

-- CreateIndex
CREATE UNIQUE INDEX "sov_ledger_identity_idx_v3" ON "LedgerActivity"("immutableId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerActivity_transactionHash_key" ON "LedgerActivity"("transactionHash");

-- CreateIndex
CREATE INDEX "LedgerActivity_usdValue_idx" ON "LedgerActivity"("usdValue");

-- CreateIndex
CREATE INDEX "LedgerActivity_valueBTC_idx" ON "LedgerActivity"("valueBTC");

-- CreateIndex
CREATE INDEX "LedgerActivity_timestamp_idx" ON "LedgerActivity"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "LedgerActivity_institutional_idx" ON "LedgerActivity"("institutional");

-- CreateIndex
CREATE INDEX "LedgerActivity_entityName_idx" ON "LedgerActivity"("entityName");

-- CreateIndex
CREATE INDEX "LedgerActivity_chain_timestamp_idx" ON "LedgerActivity"("chain", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "LedgerActivity_chain_timestamp_usdValue_idx" ON "LedgerActivity"("chain", "timestamp" DESC, "usdValue");

-- CreateIndex
CREATE INDEX "LedgerActivity_institutional_usdValue_timestamp_idx" ON "LedgerActivity"("institutional", "usdValue", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "LedgerActivity_token_chain_timestamp_idx" ON "LedgerActivity"("token", "chain", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "LedgerActivity_fromAddress_timestamp_idx" ON "LedgerActivity"("fromAddress", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "LedgerActivity_toAddress_timestamp_idx" ON "LedgerActivity"("toAddress", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "BRCStandard_brcNumber_key" ON "BRCStandard"("brcNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAlert_walletAddress_key" ON "TelegramAlert"("walletAddress");

-- CreateIndex
CREATE INDEX "TelegramAlert_walletAddress_idx" ON "TelegramAlert"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_txHash_key" ON "Transaction"("txHash");

-- CreateIndex
CREATE INDEX "Transaction_identityHash_idx" ON "Transaction"("identityHash");

-- CreateIndex
CREATE INDEX "Transaction_fromAddress_type_timestamp_idx" ON "Transaction"("fromAddress", "type", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SocialRecovery_userEmail_key" ON "SocialRecovery"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalLedgerEvent_txHash_key" ON "GlobalLedgerEvent"("txHash");

-- CreateIndex
CREATE INDEX "GlobalLedgerEvent_protocol_timestamp_idx" ON "GlobalLedgerEvent"("protocol", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "GlobalLedgerEvent_amountUSD_idx" ON "GlobalLedgerEvent"("amountUSD" DESC);

-- CreateIndex
CREATE INDEX "GlobalLedgerEvent_timestamp_idx" ON "GlobalLedgerEvent"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_userId_timestamp_idx" ON "AuditLog"("userId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_action_timestamp_idx" ON "AuditLog"("action", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "system_audit_log_payloadHash_key" ON "system_audit_log"("payloadHash");

-- CreateIndex
CREATE INDEX "system_audit_log_event_createdAt_idx" ON "system_audit_log"("event", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "system_audit_log_actor_createdAt_idx" ON "system_audit_log"("actor", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "system_audit_log_createdAt_idx" ON "system_audit_log"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ApiPurchaseIntent_stripeSessionId_key" ON "ApiPurchaseIntent"("stripeSessionId");

-- CreateIndex
CREATE INDEX "ApiPurchaseIntent_userId_createdAt_idx" ON "ApiPurchaseIntent"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "KYCRecord_userId_key" ON "KYCRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainTransaction_txHash_key" ON "BlockchainTransaction"("txHash");

-- CreateIndex
CREATE INDEX "BlockchainTransaction_userId_idx" ON "BlockchainTransaction"("userId");

-- CreateIndex
CREATE INDEX "BlockchainTransaction_status_createdAt_idx" ON "BlockchainTransaction"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BlockchainTransaction_blockNumber_idx" ON "BlockchainTransaction"("blockNumber" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeBalance_userId_asset_key" ON "ExchangeBalance"("userId", "asset");

-- CreateIndex
CREATE INDEX "Log_createdAt_idx" ON "Log"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UserPrivacyProfile_userId_key" ON "UserPrivacyProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CosmicEntity_seedHash_key" ON "CosmicEntity"("seedHash");

-- CreateIndex
CREATE INDEX "CosmicEntity_status_createdAt_idx" ON "CosmicEntity"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CosmicEntity_tier_amountUSD_idx" ON "CosmicEntity"("tier", "amountUSD" DESC);

-- CreateIndex
CREATE INDEX "CosmicEntity_chain_createdAt_idx" ON "CosmicEntity"("chain", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "VirtualCard_userId_key" ON "VirtualCard"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualCard_cardNumber_key" ON "VirtualCard"("cardNumber");

-- CreateIndex
CREATE INDEX "VirtualCard_userId_idx" ON "VirtualCard"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GamificationRecord_userId_key" ON "GamificationRecord"("userId");

-- CreateIndex
CREATE INDEX "GamificationRecord_userId_idx" ON "GamificationRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumCategory_slug_key" ON "ForumCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ForumTag_name_key" ON "ForumTag"("name");

-- CreateIndex
CREATE INDEX "ForumTopic_categoryId_createdAt_idx" ON "ForumTopic"("categoryId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ForumTopic_authorId_createdAt_idx" ON "ForumTopic"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ForumPost_topicId_createdAt_idx" ON "ForumPost"("topicId", "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ForumLike_userId_topicId_key" ON "ForumLike"("userId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumLike_userId_postId_key" ON "ForumLike"("userId", "postId");

-- CreateIndex
CREATE INDEX "ForumNotification_userId_isRead_createdAt_idx" ON "ForumNotification"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ForumTelemetry_action_createdAt_idx" ON "ForumTelemetry"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ForumTelemetry_userId_createdAt_idx" ON "ForumTelemetry"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BetaTelemetry_metricType_timestamp_idx" ON "BetaTelemetry"("metricType", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "NPSSurvey_walletAddress_key" ON "NPSSurvey"("walletAddress");

-- CreateIndex
CREATE INDEX "VerificationCode_userId_used_expiresAt_idx" ON "VerificationCode"("userId", "used", "expiresAt");

-- CreateIndex
CREATE INDEX "VerificationCode_code_idx" ON "VerificationCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WalletAnalytics_address_key" ON "WalletAnalytics"("address");

-- CreateIndex
CREATE INDEX "WalletAnalytics_address_idx" ON "WalletAnalytics"("address");

-- CreateIndex
CREATE INDEX "WalletAnalytics_category_idx" ON "WalletAnalytics"("category");

-- CreateIndex
CREATE INDEX "Notification_userId_isGlobal_idx" ON "Notification"("userId", "isGlobal");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductPassport_publicSlug_key" ON "ProductPassport"("publicSlug");

-- CreateIndex
CREATE INDEX "ProductPassport_issuerAddress_idx" ON "ProductPassport"("issuerAddress");

-- CreateIndex
CREATE INDEX "ProductPassport_gs1Gtin_idx" ON "ProductPassport"("gs1Gtin");

-- CreateIndex
CREATE INDEX "ProductPassport_createdAt_idx" ON "ProductPassport"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProvenanceEvent_passportId_createdAt_idx" ON "ProvenanceEvent"("passportId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ZkNullifier_nullifierHash_key" ON "ZkNullifier"("nullifierHash");

-- CreateIndex
CREATE INDEX "ZkNullifier_nullifierHash_idx" ON "ZkNullifier"("nullifierHash");

-- CreateIndex
CREATE INDEX "MarketProposal_status_createdAt_idx" ON "MarketProposal"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MarketProposal_category_idx" ON "MarketProposal"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalVote_nullifierHash_key" ON "ProposalVote"("nullifierHash");

-- CreateIndex
CREATE INDEX "ProposalVote_proposalId_vote_idx" ON "ProposalVote"("proposalId", "vote");

-- CreateIndex
CREATE INDEX "ProposalVote_voterAddress_votedAt_idx" ON "ProposalVote"("voterAddress", "votedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ProposalVote_proposalId_nullifierHash_key" ON "ProposalVote"("proposalId", "nullifierHash");

-- CreateIndex
CREATE UNIQUE INDEX "UserMetrics_userAddress_key" ON "UserMetrics"("userAddress");

-- CreateIndex
CREATE INDEX "UserMetrics_votescast_idx" ON "UserMetrics"("votescast" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "AztecQuest_slug_key" ON "AztecQuest"("slug");

-- CreateIndex
CREATE INDEX "QuestClaim_identityHash_status_idx" ON "QuestClaim"("identityHash", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QuestClaim_questId_identityHash_key" ON "QuestClaim"("questId", "identityHash");

-- CreateIndex
CREATE UNIQUE INDEX "QuestClaim_questId_ipHash_key" ON "QuestClaim"("questId", "ipHash");

-- CreateIndex
CREATE INDEX "QdTransaction_aztecAddress_createdAt_idx" ON "QdTransaction"("aztecAddress", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "QdTransaction_type_idx" ON "QdTransaction"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SovereignNode_aztecAddress_key" ON "SovereignNode"("aztecAddress");

-- CreateIndex
CREATE INDEX "SovereignNode_aztecAddress_active_idx" ON "SovereignNode"("aztecAddress", "active");

-- CreateIndex
CREATE INDEX "SovereignNode_identityHash_idx" ON "SovereignNode"("identityHash");

-- CreateIndex
CREATE UNIQUE INDEX "SocialVerification_walletAddress_key" ON "SocialVerification"("walletAddress");

-- CreateIndex
CREATE INDEX "SocialVerification_walletAddress_idx" ON "SocialVerification"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "AirdropClaim_txHash_key" ON "AirdropClaim"("txHash");

-- CreateIndex
CREATE INDEX "AirdropClaim_walletAddress_idx" ON "AirdropClaim"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "AirdropClaim_walletAddress_year_month_key" ON "AirdropClaim"("walletAddress", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_walletAddress_key" ON "UserSettings"("walletAddress");

-- CreateIndex
CREATE INDEX "UserSettings_walletAddress_idx" ON "UserSettings"("walletAddress");

-- CreateIndex
CREATE INDEX "StatusUpdate_ownerAddress_idx" ON "StatusUpdate"("ownerAddress");

-- CreateIndex
CREATE INDEX "StatusUpdate_expiresAt_idx" ON "StatusUpdate"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Community_joinCode_key" ON "Community"("joinCode");

-- CreateIndex
CREATE INDEX "Community_joinCode_idx" ON "Community"("joinCode");

-- CreateIndex
CREATE INDEX "Community_ownerAddress_idx" ON "Community"("ownerAddress");

-- CreateIndex
CREATE INDEX "CommunityMember_walletAddress_idx" ON "CommunityMember"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMember_communityId_walletAddress_key" ON "CommunityMember"("communityId", "walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "QDCreditLedger_txRef_key" ON "QDCreditLedger"("txRef");

-- CreateIndex
CREATE UNIQUE INDEX "QDCreditLedger_idempotencyKey_key" ON "QDCreditLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "QDCreditLedger_address_idx" ON "QDCreditLedger"("address");

-- CreateIndex
CREATE INDEX "QDCreditLedger_txRef_idx" ON "QDCreditLedger"("txRef");

-- CreateIndex
CREATE INDEX "CommunityPost_communityId_idx" ON "CommunityPost"("communityId");

-- CreateIndex
CREATE INDEX "CommunityPost_authorAddress_idx" ON "CommunityPost"("authorAddress");

-- CreateIndex
CREATE INDEX "LoginGeoEvent_userId_idx" ON "LoginGeoEvent"("userId");

-- CreateIndex
CREATE INDEX "LoginGeoEvent_countryCode_idx" ON "LoginGeoEvent"("countryCode");

-- CreateIndex
CREATE INDEX "LoginGeoEvent_createdAt_idx" ON "LoginGeoEvent"("createdAt");

-- CreateIndex
CREATE INDEX "CommunityChannel_communityId_idx" ON "CommunityChannel"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityPermission_communityId_key" ON "CommunityPermission"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_walletAddress_key" ON "PushSubscription"("walletAddress");

-- CreateIndex
CREATE INDEX "PushSubscription_walletAddress_idx" ON "PushSubscription"("walletAddress");

-- CreateIndex
CREATE INDEX "DirectMessage_recipient_delivered_idx" ON "DirectMessage"("recipient", "delivered");

-- CreateIndex
CREATE INDEX "DirectMessage_sender_idx" ON "DirectMessage"("sender");

-- CreateIndex
CREATE INDEX "Story_authorAddress_idx" ON "Story"("authorAddress");

-- CreateIndex
CREATE INDEX "Story_expiresAt_idx" ON "Story"("expiresAt");

-- CreateIndex
CREATE INDEX "_TopicTags_B_index" ON "_TopicTags"("B");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanityEvent" ADD CONSTRAINT "HumanityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("walletAddress") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchedWallet" ADD CONSTRAINT "WatchedWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangePosition" ADD CONSTRAINT "ExchangePosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("walletAddress") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasState" ADD CONSTRAINT "CanvasState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanitySession" ADD CONSTRAINT "HumanitySession_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "HumanityIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademySubmission" ADD CONSTRAINT "AcademySubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademySubmission" ADD CONSTRAINT "AcademySubmission_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringMessage" ADD CONSTRAINT "MentoringMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringMessage" ADD CONSTRAINT "MentoringMessage_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityLabel" ADD CONSTRAINT "EntityLabel_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "OnChainEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopic" ADD CONSTRAINT "ForumTopic_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ForumCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopic" ADD CONSTRAINT "ForumTopic_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumLike" ADD CONSTRAINT "ForumLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumLike" ADD CONSTRAINT "ForumLike_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumLike" ADD CONSTRAINT "ForumLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumNotification" ADD CONSTRAINT "ForumNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumNotification" ADD CONSTRAINT "ForumNotification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumNotification" ADD CONSTRAINT "ForumNotification_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumNotification" ADD CONSTRAINT "ForumNotification_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvenanceEvent" ADD CONSTRAINT "ProvenanceEvent_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "ProductPassport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalVote" ADD CONSTRAINT "ProposalVote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "MarketProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestClaim" ADD CONSTRAINT "QuestClaim_questId_fkey" FOREIGN KEY ("questId") REFERENCES "AztecQuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityChannel" ADD CONSTRAINT "CommunityChannel_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPermission" ADD CONSTRAINT "CommunityPermission_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TopicTags" ADD CONSTRAINT "_TopicTags_A_fkey" FOREIGN KEY ("A") REFERENCES "ForumTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TopicTags" ADD CONSTRAINT "_TopicTags_B_fkey" FOREIGN KEY ("B") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

