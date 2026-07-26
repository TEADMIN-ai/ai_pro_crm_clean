import { sanitizeComplianceDocumentBreakdownForFirestore } from '@/lib/server/recalculateContractorCompliance';

describe('recalculateContractorCompliance sanitizer', () => {
  test('normalizes optional compliance breakdown fields before Firestore persistence', () => {
    const sanitized = sanitizeComplianceDocumentBreakdownForFirestore([
      {
        documentType: 'taxClearance',
        label: 'Tax Clearance',
        weight: 30,
        status: 'uploaded',
        weightedScore: 8,
        complianceScore: 25,
        confidenceScore: 82,
        verified: false,
        expiresAt: null,
        reason: 'Awaiting review',
        suggestions: ['Upload updated TCS certificate'],
        missingFields: [],
        taxDocumentCategory: undefined,
        taxDocumentPurpose: undefined,
        taxClassificationConfidence: undefined,
        taxComplianceCapable: undefined,
        taxSupportingOnly: undefined,
        readinessImpactReason: undefined,
      },
    ]);

    expect(sanitized).toEqual([
      expect.objectContaining({
        documentType: 'taxClearance',
        taxDocumentCategory: null,
        taxDocumentPurpose: null,
        taxClassificationConfidence: null,
        taxComplianceCapable: null,
        taxSupportingOnly: null,
        readinessImpactReason: null,
      }),
    ]);
    expect(JSON.stringify(sanitized)).not.toContain('undefined');
  });
});

describe('Phase 4 divergence observation', () => {
  async function loadDivergenceModule(options?: {
    getImpl?: () => Promise<{ exists: boolean; id: string; data: () => Record<string, unknown> }>;
    emitImpl?: (event: unknown) => void;
  }) {
    jest.resetModules();

    const getMock = jest.fn(
      options?.getImpl ??
        (async () => ({
          exists: true,
          id: 'taxClearance',
          data: () => ({
            contractorId: 'contractor-1',
            documentType: 'taxClearance',
            fileUrl: 'https://example.com/doc.pdf',
            status: 'verified',
            verified: true,
          }),
        }))
    );
    const emitMock = jest.fn((event: unknown) => {
      options?.emitImpl?.(event);
    });

    jest.doMock('@/lib/firebase/admin', () => ({
      getFirebaseAdmin: () => ({
        collection: () => ({
          doc: () => ({
            collection: () => ({
              doc: () => ({ get: getMock }),
            }),
          }),
        }),
      }),
    }));

    jest.doMock('@/lib/governance/emitter', () => ({
      emitGovernanceEvent: (...args: unknown[]) => emitMock.apply(null, args),
    }));

    const module = await import('@/lib/governance/divergence');
    return { observeLegacyCanonicalDocumentStatus: module.observeLegacyCanonicalDocumentStatus, getMock, emitMock };
  }

  test('legacy_canonical_match_observed is emitted when legacy and canonical states match', async () => {
    const { observeLegacyCanonicalDocumentStatus, getMock, emitMock } = await loadDivergenceModule();

    observeLegacyCanonicalDocumentStatus({
      governanceContext: {
        correlationId: 'corr-1',
        requestId: 'req-1',
        timestamp: '2026-07-26T10:00:00.000Z',
        actor: { actorId: 'user-1', actorEmail: 'user@example.com', actorRole: 'manager' },
        route: {
          sourceName: 'top_level_document_status_patch',
          sourceType: 'route',
          sourceClassification: 'legacy',
          routePath: '/api/documents/[documentId]/status',
          method: 'PATCH',
        },
      },
      contractorId: 'contractor-1',
      documentId: 'doc-1',
      documentType: 'taxClearance',
      legacyStatus: 'approved',
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'legacy_canonical_match_observed',
        comparison: expect.objectContaining({ divergenceFields: [] }),
      })
    );
  });

  test('legacy_canonical_divergence_observed is emitted when legacy and canonical states differ', async () => {
    const { observeLegacyCanonicalDocumentStatus, emitMock } = await loadDivergenceModule({
      getImpl: async () => ({
        exists: true,
        id: 'taxClearance',
        data: () => ({
          contractorId: 'contractor-2',
          documentType: 'taxClearance',
          fileUrl: 'https://example.com/doc.pdf',
          status: 'invalid',
          verified: false,
        }),
      }),
    });

    observeLegacyCanonicalDocumentStatus({
      governanceContext: {
        correlationId: 'corr-2',
        requestId: 'req-2',
        timestamp: '2026-07-26T10:00:00.000Z',
        actor: { actorId: 'user-2', actorEmail: 'user2@example.com', actorRole: 'manager' },
        route: {
          sourceName: 'top_level_document_patch',
          sourceType: 'route',
          sourceClassification: 'hybrid',
          routePath: '/api/documents/[documentId]',
          method: 'PATCH',
        },
      },
      contractorId: 'contractor-2',
      documentId: 'doc-2',
      documentType: 'taxClearance',
      legacyStatus: 'approved',
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'legacy_canonical_divergence_observed',
        comparison: expect.objectContaining({ divergenceFields: ['status'] }),
      })
    );
  });

  test('observer or emitter failure downgrades to governance warning without introducing writes', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { observeLegacyCanonicalDocumentStatus, emitMock } = await loadDivergenceModule({
      emitImpl: () => {
        throw new Error('emit exploded');
      },
    });

    observeLegacyCanonicalDocumentStatus({
      governanceContext: {
        correlationId: 'corr-3',
        requestId: 'req-3',
        timestamp: '2026-07-26T10:00:00.000Z',
        actor: { actorId: 'user-3', actorEmail: 'user3@example.com', actorRole: 'manager' },
        route: {
          sourceName: 'top_level_document_patch',
          sourceType: 'route',
          sourceClassification: 'hybrid',
          routePath: '/api/documents/[documentId]',
          method: 'PATCH',
        },
      },
      contractorId: 'contractor-3',
      documentId: 'doc-3',
      documentType: 'taxClearance',
      legacyStatus: 'approved',
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(emitMock).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[governance_divergence_observation_failed]',
      expect.objectContaining({ contractorId: 'contractor-3' })
    );

    warnSpy.mockRestore();
  });

  test('stale_state_compensation_observed and canonical_overwrite_after_legacy_write_observed are emitted under the intended stale condition', async () => {
    jest.resetModules();

    const emitMock = jest.fn();
    const calculateMock = jest.fn().mockReturnValue({
      readinessScore: 85,
      docsMissing: 0,
      tenderLockStatus: 'READY',
      isTenderLocked: false,
      complianceStatusScore: 85,
      expiredDocumentCount: 0,
      expiringSoonCount: 0,
      activeAlerts: [],
      missingDocumentTypes: [],
    });
    const intelligenceMock = jest.fn().mockReturnValue({
      complianceConfidence: 90,
      readinessConfidence: 88,
      operationalSubmissionConfidence: 92,
      riskGrade: 'low',
      explainableSummary: 'Ready',
      blockedReasons: [],
      reviewRecommendations: [],
      missingCriticalDocuments: [],
      verifiedCriticalDocuments: ['taxClearance'],
      averageDocumentConfidence: 90,
      telemetry: {},
      documentBreakdown: [],
    });
    const persistMock = jest.fn().mockResolvedValue(undefined);
    const contractorSet = jest.fn().mockResolvedValue(undefined);

    jest.doMock('@/lib/governance/emitter', () => ({
      emitGovernanceEvent: (...args: unknown[]) => emitMock.apply(null, args),
    }));
    jest.doMock('@/lib/compliance/complianceOperationalEvents', () => ({
      persistComplianceOperationalEvents: (...args: unknown[]) => persistMock(...args),
    }));
    jest.doMock('@/lib/compliance/contractorComplianceIntelligence', () => ({
      buildContractorComplianceIntelligence: (...args: unknown[]) => intelligenceMock(...args),
    }));
    jest.doMock('@/lib/compliance/contractorCompliance', () => ({
      LEGACY_COMPLIANCE_REQUIREMENT_KEYS: ['tax'],
      calculateContractorCompliance: (...args: unknown[]) => calculateMock(...args),
      resolveContractorDocumentStatus: jest.fn((document: { status?: string }) => document.status ?? 'missing'),
      toLegacyComplianceRequirementKey: jest.fn((documentType?: string) =>
        documentType === 'taxClearance' ? 'tax' : null
      ),
    }));

    const { recalculateContractorCompliance } = await import('@/lib/server/recalculateContractorCompliance');
    const db = {
      collection: (name: string) => {
        if (name === 'contractors') {
          return {
            doc: () => ({
              get: jest.fn().mockResolvedValue({
                data: () => ({
                  readinessScore: 10,
                  docsMissing: 3,
                  tenderLockStatus: 'LOCKED',
                  isTenderLocked: true,
                }),
              }),
              set: contractorSet,
              collection: () => ({
                get: jest.fn().mockResolvedValue({
                  docs: [
                    {
                      id: 'taxClearance',
                      data: () => ({
                        contractorId: 'contractor-4',
                        documentType: 'taxClearance',
                        fileUrl: 'https://example.com/doc.pdf',
                        status: 'verified',
                        verified: true,
                      }),
                    },
                  ],
                }),
              }),
            }),
          };
        }

        if (name === 'deals') {
          return {
            where: () => ({
              get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
            }),
          };
        }

        throw new Error('Unexpected collection ' + name);
      },
      batch: () => ({ set: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) }),
    } as any;

    const result = await recalculateContractorCompliance(db, 'contractor-4', {
      correlationId: 'corr-4',
      requestId: 'req-4',
      timestamp: '2026-07-26T10:00:00.000Z',
      actor: { actorId: 'user-4', actorEmail: 'user4@example.com', actorRole: 'manager' },
      route: {
        sourceName: 'top_level_document_patch',
        sourceType: 'route',
        sourceClassification: 'hybrid',
        routePath: '/api/documents/[documentId]',
        method: 'PATCH',
      },
    });

    expect(result.readinessScore).toBe(85);
    expect(contractorSet).toHaveBeenCalledTimes(1);
    expect(persistMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'stale_state_compensation_observed',
        comparison: expect.objectContaining({
          divergenceFields: ['readinessScore', 'docsMissing', 'tenderLockStatus', 'isTenderLocked'],
          staleStateDetected: true,
          changedState: true,
        }),
      })
    );
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'canonical_overwrite_after_legacy_write_observed',
        comparison: expect.objectContaining({
          divergenceFields: ['readinessScore', 'docsMissing', 'tenderLockStatus', 'isTenderLocked'],
          staleStateDetected: true,
          changedState: true,
        }),
      })
    );
  });

  test('route observation is scheduled through queueMicrotask and observer failure stays fail-open without extra writes', async () => {
    jest.resetModules();

    const requireAuthorizedUser = jest.fn().mockResolvedValue({
      uid: 'manager-1',
      email: 'manager@example.com',
      role: 'manager',
    });
    const assertPrivilegedRole = jest.fn();
    const emitGovernanceEvent = jest.fn();
    const observeLegacyCanonicalDocumentStatus = jest.fn(() => {
      throw new Error('observer exploded');
    });
    const recalculateContractorCompliance = jest.fn().mockResolvedValue(undefined);
    const generateFixSuggestion = jest.fn();
    const documentUpdate = jest.fn().mockResolvedValue(undefined);
    const documentGet = jest
      .fn()
      .mockResolvedValueOnce({
        exists: true,
        id: 'doc-5',
        data: () => ({ contractorId: 'contractor-5', documentType: 'taxClearance', status: 'uploaded' }),
      })
      .mockResolvedValueOnce({
        exists: true,
        id: 'doc-5',
        data: () => ({
          contractorId: 'contractor-5',
          documentType: 'taxClearance',
          status: 'approved',
          reviewedAt: 123,
          reviewedBy: 'manager-1',
          fixSuggestion: null,
        }),
      });

    jest.doMock('firebase-admin/firestore', () => ({
      FieldValue: {
        delete: jest.fn(() => 'DELETE_FIELD'),
        serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
      },
    }));
    jest.doMock('@/lib/server/authz', () => ({
      AuthorizationError: class AuthorizationError extends Error {
        status: number;

        constructor(message: string, status = 403) {
          super(message);
          this.status = status;
        }
      },
      assertPrivilegedRole: (...args: unknown[]) => assertPrivilegedRole(...args),
      requireAuthorizedUser: (...args: unknown[]) => requireAuthorizedUser(...args),
    }));
    jest.doMock('@/lib/firebase/admin', () => ({
      getFirebaseAdmin: () => ({
        collection: (name: string) => {
          if (name !== 'documents') {
            throw new Error('Unexpected collection ' + name);
          }

          return {
            doc: () => ({
              get: documentGet,
              update: documentUpdate,
            }),
          };
        },
      }),
    }));
    jest.doMock('@/lib/governance/divergence', () => ({
      observeLegacyCanonicalDocumentStatus: (...args: unknown[]) => observeLegacyCanonicalDocumentStatus.apply(null, args),
    }));
    jest.doMock('@/lib/governance/emitter', () => ({
      emitGovernanceEvent: (...args: unknown[]) => emitGovernanceEvent.apply(null, args),
    }));
    jest.doMock('@/lib/governance/observer', () => ({
      withGovernanceObservation:
        (_route: unknown, handler: (request: Request, context: unknown, governanceContext: unknown) => Promise<Response>) =>
        (request: Request, context: unknown) =>
          handler(request, context, {
            correlationId: 'corr-5',
            requestId: 'req-5',
            timestamp: '2026-07-26T10:00:00.000Z',
            actor: { actorId: 'manager-1', actorEmail: 'manager@example.com', actorRole: 'manager' },
            route: {
              sourceName: 'top_level_document_patch',
              sourceType: 'route',
              sourceClassification: 'hybrid',
              routePath: '/api/documents/[documentId]',
              method: 'PATCH',
            },
          }),
    }));
    jest.doMock('@/lib/services/aiFixService', () => ({
      generateFixSuggestion: (...args: unknown[]) => generateFixSuggestion(...args),
    }));
    jest.doMock('@/lib/server/recalculateContractorCompliance', () => ({
      recalculateContractorCompliance: (...args: unknown[]) => recalculateContractorCompliance(...args),
    }));

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const queueMicrotaskSpy = jest.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback: VoidFunction) => {
      callback();
    });

    const { NextRequest } = await import('next/server');
    const { PATCH } = await import('@/app/api/documents/[documentId]/route');

    const response = await PATCH(
      new NextRequest('http://localhost/api/documents/doc-5', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ documentId: 'doc-5' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      document: {
        id: 'doc-5',
        status: 'approved',
        fixSuggestion: null,
        reviewedAt: 123,
        reviewedBy: 'manager-1',
      },
    });
    expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1);
    expect(documentUpdate).toHaveBeenCalledTimes(1);
    expect(documentGet).toHaveBeenCalledTimes(2);
    expect(recalculateContractorCompliance).toHaveBeenCalledTimes(1);
    expect(observeLegacyCanonicalDocumentStatus).toHaveBeenCalledTimes(1);
    expect(documentUpdate.mock.invocationCallOrder[0]).toBeLessThan(recalculateContractorCompliance.mock.invocationCallOrder[0]);
    expect(recalculateContractorCompliance.mock.invocationCallOrder[0]).toBeLessThan(observeLegacyCanonicalDocumentStatus.mock.invocationCallOrder[0]);
    expect(warnSpy).toHaveBeenCalledWith(
      '[governance_divergence_observation_failed]',
      expect.objectContaining({
        sourceName: 'top_level_document_patch',
        documentId: 'doc-5',
        contractorId: 'contractor-5',
        documentType: 'taxClearance',
        reason: 'observer exploded',
      })
    );
    expect(generateFixSuggestion).not.toHaveBeenCalled();

    queueMicrotaskSpy.mockRestore();
    warnSpy.mockRestore();
  });
});