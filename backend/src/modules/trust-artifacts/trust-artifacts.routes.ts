import { Router } from 'express'
import multer from 'multer'
import {
  listTrustArtifactsController,
  getTrustArtifactController,
  createTrustArtifactController,
  updateTrustArtifactController,
  deleteTrustArtifactController,
  getJobTrustSummaryController,
  getVehicleTrustHistoryController,
} from './trust-artifacts.controller'
import { authenticate } from '@middleware/auth'

const router = Router()

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
})

// All routes require authentication
router.use(authenticate)

/**
 * GET /api/trust-artifacts
 * List trust artifacts with optional filters
 */
router.get('/', listTrustArtifactsController)

/**
 * POST /api/trust-artifacts
 * Upload a file and create trust artifact
 */
router.post('/', upload.single('file'), createTrustArtifactController)

/**
 * GET /api/trust-artifacts/job/:jobId/summary
 * Get trust artifacts summary for a job
 */
router.get('/job/:jobId/summary', getJobTrustSummaryController)

/**
 * GET /api/trust-artifacts/vehicle/:vehicleId/history
 * Get trust artifacts history for a vehicle
 */
router.get('/vehicle/:vehicleId/history', getVehicleTrustHistoryController)

/**
 * GET /api/trust-artifacts/:id
 * Get a single trust artifact by ID
 */
router.get('/:id', getTrustArtifactController)

/**
 * PUT /api/trust-artifacts/:id
 * Update trust artifact metadata (not the file)
 */
router.put('/:id', updateTrustArtifactController)

/**
 * DELETE /api/trust-artifacts/:id
 * Delete a trust artifact (soft delete + delete from Azure)
 */
router.delete('/:id', deleteTrustArtifactController)

export default router
