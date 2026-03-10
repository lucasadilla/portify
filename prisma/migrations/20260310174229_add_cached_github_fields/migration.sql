-- CreateEnum
CREATE TYPE "RepoStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('screenshot', 'diagram', 'build_log');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('analyze', 'summary', 'build', 'screenshot', 'diagram');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'ACTIVE', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "githubId" TEXT,
    "username" TEXT,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "bio" TEXT,
    "socialsJson" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "backgroundStyle" TEXT NOT NULL DEFAULT 'minimal',
    "backgroundOptionsJson" TEXT,
    "displayName" TEXT,
    "imageUrl" TEXT,
    "sectionOrderJson" TEXT,
    "contributionsChartOrderJson" TEXT,
    "colorPalette" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contributionsJson" TEXT,
    "languagesJson" TEXT,
    "githubJoinDate" TEXT,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioTimelineEntry" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "kind" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioTimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioRepo" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "pinnedOrder" INTEGER NOT NULL DEFAULT 0,
    "customTitle" TEXT,
    "customSummary" TEXT,
    "projectWebsiteUrl" TEXT,
    "showCommitsGraph" BOOLEAN NOT NULL DEFAULT true,
    "showLanguagesGraph" BOOLEAN NOT NULL DEFAULT true,
    "showScreenshots" BOOLEAN NOT NULL DEFAULT true,
    "showDiagram" BOOLEAN NOT NULL DEFAULT true,
    "detectedStackJson" TEXT,
    "status" "RepoStatus" NOT NULL DEFAULT 'QUEUED',
    "runnable" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commitHistoryJson" TEXT,
    "languageBreakdownJson" TEXT,

    CONSTRAINT "PortfolioRepo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepoArtifact" (
    "id" TEXT NOT NULL,
    "portfolioRepoId" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "url" TEXT NOT NULL,
    "metadata" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepoArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "portfolioRepoId" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_userId_key" ON "Portfolio"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_slug_key" ON "Portfolio"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioRepo_portfolioId_repoFullName_key" ON "PortfolioRepo"("portfolioId", "repoFullName");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioTimelineEntry" ADD CONSTRAINT "PortfolioTimelineEntry_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioRepo" ADD CONSTRAINT "PortfolioRepo_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepoArtifact" ADD CONSTRAINT "RepoArtifact_portfolioRepoId_fkey" FOREIGN KEY ("portfolioRepoId") REFERENCES "PortfolioRepo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_portfolioRepoId_fkey" FOREIGN KEY ("portfolioRepoId") REFERENCES "PortfolioRepo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
