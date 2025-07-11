import { describe, it, expect, beforeEach } from "vitest"

describe("Activity Planning Contract", () => {
  let contractState
  let mockTxSender
  let mockBlockHeight
  
  beforeEach(() => {
    contractState = {
      contractPaused: false,
      nextActivityId: 1,
      nextSessionId: 1,
      nextResourceId: 1,
      activities: new Map(),
      activitySessions: new Map(),
      sessionParticipants: new Map(),
      childSessions: new Map(),
      activityResources: new Map(),
      resourceReservations: new Map(),
      authorizedPlanners: new Map(),
    }
    
    mockTxSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    mockBlockHeight = 1000
  })
  
  describe("Activity Management", () => {
    beforeEach(() => {
      contractState.authorizedPlanners.set(mockTxSender, true)
    })
    
    it("should create activity successfully", () => {
      const nameHash = new Uint8Array(32).fill(1)
      const descriptionHash = new Uint8Array(32).fill(2)
      const ageGroup = "toddler"
      const minAge = 2
      const maxAge = 4
      const category = "educational"
      const durationMinutes = 60
      const maxParticipants = 10
      const requiredResources = [1, 2]
      const safetyRequirementsHash = new Uint8Array(32).fill(3)
      
      const result = createActivity(
          mockTxSender,
          nameHash,
          descriptionHash,
          ageGroup,
          minAge,
          maxAge,
          category,
          durationMinutes,
          maxParticipants,
          requiredResources,
          safetyRequirementsHash,
          contractState,
          mockBlockHeight,
      )
      
      expect(result.success).toBe(true)
      expect(result.activityId).toBe(1)
      expect(contractState.nextActivityId).toBe(2)
      
      const activity = contractState.activities.get(1)
      expect(activity.ageGroup).toBe(ageGroup)
      expect(activity.minAge).toBe(minAge)
      expect(activity.maxAge).toBe(maxAge)
      expect(activity.active).toBe(true)
    })
    
    it("should validate age range", () => {
      const result = createActivity(
          mockTxSender,
          new Uint8Array(32).fill(1),
          new Uint8Array(32).fill(2),
          "toddler",
          5, // min age greater than max age
          4,
          "educational",
          60,
          10,
          [1, 2],
          new Uint8Array(32).fill(3),
          contractState,
          mockBlockHeight,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_INVALID_INPUT")
    })
    
    it("should prevent unauthorized users from creating activities", () => {
      const unauthorizedUser = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"
      
      const result = createActivity(
          unauthorizedUser,
          new Uint8Array(32).fill(1),
          new Uint8Array(32).fill(2),
          "toddler",
          2,
          4,
          "educational",
          60,
          10,
          [1, 2],
          new Uint8Array(32).fill(3),
          contractState,
          mockBlockHeight,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_UNAUTHORIZED")
    })
    
    it("should update activity successfully", () => {
      // Create initial activity
      contractState.activities.set(1, {
        nameHash: new Uint8Array(32).fill(1),
        descriptionHash: new Uint8Array(32).fill(2),
        ageGroup: "toddler",
        minAge: 2,
        maxAge: 4,
        category: "educational",
        durationMinutes: 60,
        maxParticipants: 10,
        requiredResources: [1, 2],
        safetyRequirementsHash: new Uint8Array(32).fill(3),
        createdBy: mockTxSender,
        createdDate: mockBlockHeight,
        active: true,
      })
      
      const newNameHash = new Uint8Array(32).fill(4)
      const newDescriptionHash = new Uint8Array(32).fill(5)
      const newDurationMinutes = 90
      const newMaxParticipants = 15
      const newSafetyRequirementsHash = new Uint8Array(32).fill(6)
      
      const result = updateActivity(
          mockTxSender,
          1,
          newNameHash,
          newDescriptionHash,
          newDurationMinutes,
          newMaxParticipants,
          newSafetyRequirementsHash,
          contractState,
      )
      
      expect(result.success).toBe(true)
      
      const activity = contractState.activities.get(1)
      expect(activity.nameHash).toEqual(newNameHash)
      expect(activity.durationMinutes).toBe(newDurationMinutes)
      expect(activity.maxParticipants).toBe(newMaxParticipants)
    })
    
    it("should deactivate activity", () => {
      contractState.activities.set(1, {
        nameHash: new Uint8Array(32).fill(1),
        descriptionHash: new Uint8Array(32).fill(2),
        ageGroup: "toddler",
        minAge: 2,
        maxAge: 4,
        category: "educational",
        durationMinutes: 60,
        maxParticipants: 10,
        requiredResources: [1, 2],
        safetyRequirementsHash: new Uint8Array(32).fill(3),
        createdBy: mockTxSender,
        createdDate: mockBlockHeight,
        active: true,
      })
      
      const result = deactivateActivity(mockTxSender, 1, contractState)
      
      expect(result.success).toBe(true)
      
      const activity = contractState.activities.get(1)
      expect(activity.active).toBe(false)
    })
  })
  
  describe("Session Management", () => {
    beforeEach(() => {
      contractState.authorizedPlanners.set(mockTxSender, true)
      
      // Create test activity
      contractState.activities.set(1, {
        nameHash: new Uint8Array(32).fill(1),
        descriptionHash: new Uint8Array(32).fill(2),
        ageGroup: "toddler",
        minAge: 2,
        maxAge: 4,
        category: "educational",
        durationMinutes: 60,
        maxParticipants: 10,
        requiredResources: [1, 2],
        safetyRequirementsHash: new Uint8Array(32).fill(3),
        createdBy: mockTxSender,
        createdDate: mockBlockHeight,
        active: true,
      })
    })
    
    it("should schedule session successfully", () => {
      const activityId = 1
      const scheduledDate = mockBlockHeight + 1000
      const startTime = 900 // 9:00 AM
      const endTime = 1000 // 10:00 AM
      const locationHash = new Uint8Array(32).fill(4)
      const caregiverId = 1
      const maxParticipants = 8
      
      const result = scheduleSession(
          mockTxSender,
          activityId,
          scheduledDate,
          startTime,
          endTime,
          locationHash,
          caregiverId,
          maxParticipants,
          contractState,
      )
      
      expect(result.success).toBe(true)
      expect(result.sessionId).toBe(1)
      expect(contractState.nextSessionId).toBe(2)
      
      const session = contractState.activitySessions.get(1)
      expect(session.activityId).toBe(activityId)
      expect(session.status).toBe("scheduled")
      expect(session.currentParticipants).toBe(0)
    })
    
    it("should validate time range", () => {
      const result = scheduleSession(
          mockTxSender,
          1,
          mockBlockHeight + 1000,
          1000, // start time after end time
          900,
          new Uint8Array(32).fill(4),
          1,
          8,
          contractState,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_INVALID_INPUT")
    })
    
    it("should validate max participants against activity limit", () => {
      const result = scheduleSession(
          mockTxSender,
          1,
          mockBlockHeight + 1000,
          900,
          1000,
          new Uint8Array(32).fill(4),
          1,
          15, // Exceeds activity max of 10
          contractState,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_INVALID_INPUT")
    })
  })
  
  describe("Enrollment Management", () => {
    beforeEach(() => {
      // Create test session
      contractState.activitySessions.set(1, {
        activityId: 1,
        scheduledDate: mockBlockHeight + 1000,
        startTime: 900,
        endTime: 1000,
        locationHash: new Uint8Array(32).fill(4),
        caregiverId: 1,
        currentParticipants: 0,
        maxParticipants: 5,
        status: "scheduled",
        notesHash: null,
      })
    })
    
    it("should enroll child successfully", () => {
      const sessionId = 1
      const childId = 1
      
      const result = enrollChild(mockTxSender, sessionId, childId, contractState, mockBlockHeight)
      
      expect(result.success).toBe(true)
      
      const participant = contractState.sessionParticipants.get(`${sessionId}-${childId}`)
      expect(participant.enrolled).toBe(true)
      expect(participant.attendanceStatus).toBe("enrolled")
      
      const session = contractState.activitySessions.get(sessionId)
      expect(session.currentParticipants).toBe(1)
      
      const childSessions = contractState.childSessions.get(childId)
      expect(childSessions.sessionIds).toContain(sessionId)
    })
    
    it("should prevent enrollment when session is full", () => {
      // Fill up the session
      contractState.activitySessions.get(1).currentParticipants = 5
      
      const result = enrollChild(mockTxSender, 1, 1, contractState, mockBlockHeight)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_CAPACITY_FULL")
    })
    
    it("should prevent duplicate enrollment", () => {
      // First enrollment
      enrollChild(mockTxSender, 1, 1, contractState, mockBlockHeight)
      
      // Second enrollment should fail
      const result = enrollChild(mockTxSender, 1, 1, contractState, mockBlockHeight)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_ALREADY_EXISTS")
    })
    
    it("should unenroll child successfully", () => {
      // First enroll
      enrollChild(mockTxSender, 1, 1, contractState, mockBlockHeight)
      
      // Then unenroll
      const result = unenrollChild(mockTxSender, 1, 1, contractState)
      
      expect(result.success).toBe(true)
      
      const participant = contractState.sessionParticipants.get("1-1")
      expect(participant.enrolled).toBe(false)
      expect(participant.attendanceStatus).toBe("unenrolled")
      
      const session = contractState.activitySessions.get(1)
      expect(session.currentParticipants).toBe(0)
    })
  })
  
  describe("Attendance and Rating", () => {
    beforeEach(() => {
      contractState.authorizedPlanners.set(mockTxSender, true)
      
      // Create enrolled participant
      contractState.sessionParticipants.set("1-1", {
        enrolled: true,
        enrollmentDate: mockBlockHeight,
        attendanceStatus: "enrolled",
        participationRating: null,
        parentFeedbackHash: null,
      })
    })
    
    it("should mark attendance", () => {
      const result = markAttendance(mockTxSender, 1, 1, "present", contractState)
      
      expect(result.success).toBe(true)
      
      const participant = contractState.sessionParticipants.get("1-1")
      expect(participant.attendanceStatus).toBe("present")
    })
    
    it("should rate participation", () => {
      const rating = 4
      const feedbackHash = new Uint8Array(32).fill(5)
      
      const result = rateParticipation(mockTxSender, 1, 1, rating, feedbackHash, contractState)
      
      expect(result.success).toBe(true)
      
      const participant = contractState.sessionParticipants.get("1-1")
      expect(participant.participationRating).toBe(rating)
      expect(participant.parentFeedbackHash).toEqual(feedbackHash)
    })
    
    it("should validate rating range", () => {
      const result = rateParticipation(
          mockTxSender,
          1,
          1,
          6, // Invalid rating > 5
          new Uint8Array(32).fill(5),
          contractState,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_INVALID_INPUT")
    })
  })
  
  describe("Resource Management", () => {
    beforeEach(() => {
      contractState.authorizedPlanners.set(mockTxSender, true)
    })
    
    it("should add resource successfully", () => {
      const nameHash = new Uint8Array(32).fill(1)
      const descriptionHash = new Uint8Array(32).fill(2)
      const resourceType = "toy"
      const quantityAvailable = 10
      const locationHash = new Uint8Array(32).fill(3)
      
      const result = addResource(
          mockTxSender,
          nameHash,
          descriptionHash,
          resourceType,
          quantityAvailable,
          locationHash,
          contractState,
      )
      
      expect(result.success).toBe(true)
      expect(result.resourceId).toBe(1)
      expect(contractState.nextResourceId).toBe(2)
      
      const resource = contractState.activityResources.get(1)
      expect(resource.resourceType).toBe(resourceType)
      expect(resource.quantityAvailable).toBe(quantityAvailable)
      expect(resource.status).toBe("available")
    })
    
    it("should reserve resource successfully", () => {
      // Create resource first
      contractState.activityResources.set(1, {
        nameHash: new Uint8Array(32).fill(1),
        descriptionHash: new Uint8Array(32).fill(2),
        resourceType: "toy",
        quantityAvailable: 10,
        quantityReserved: 0,
        locationHash: new Uint8Array(32).fill(3),
        maintenanceDate: null,
        status: "available",
      })
      
      const result = reserveResource(
          mockTxSender,
          1, // sessionId
          1, // resourceId
          5, // quantity
          contractState,
          mockBlockHeight,
      )
      
      expect(result.success).toBe(true)
      
      const reservation = contractState.resourceReservations.get("1-1")
      expect(reservation.quantityReserved).toBe(5)
      expect(reservation.status).toBe("reserved")
      
      const resource = contractState.activityResources.get(1)
      expect(resource.quantityReserved).toBe(5)
    })
    
    it("should prevent over-reservation", () => {
      contractState.activityResources.set(1, {
        nameHash: new Uint8Array(32).fill(1),
        descriptionHash: new Uint8Array(32).fill(2),
        resourceType: "toy",
        quantityAvailable: 10,
        quantityReserved: 8, // Only 2 available
        locationHash: new Uint8Array(32).fill(3),
        maintenanceDate: null,
        status: "available",
      })
      
      const result = reserveResource(
          mockTxSender,
          1,
          1,
          5, // Requesting more than available
          contractState,
          mockBlockHeight,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_CAPACITY_FULL")
    })
  })
  
  describe("Read-only Functions", () => {
    beforeEach(() => {
      contractState.activities.set(1, {
        nameHash: new Uint8Array(32).fill(1),
        descriptionHash: new Uint8Array(32).fill(2),
        ageGroup: "toddler",
        minAge: 2,
        maxAge: 4,
        category: "educational",
        durationMinutes: 60,
        maxParticipants: 10,
        requiredResources: [1, 2],
        safetyRequirementsHash: new Uint8Array(32).fill(3),
        createdBy: mockTxSender,
        createdDate: mockBlockHeight,
        active: true,
      })
      
      contractState.activitySessions.set(1, {
        activityId: 1,
        scheduledDate: mockBlockHeight + 1000,
        startTime: 900,
        endTime: 1000,
        locationHash: new Uint8Array(32).fill(4),
        caregiverId: 1,
        currentParticipants: 3,
        maxParticipants: 5,
        status: "scheduled",
        notesHash: null,
      })
    })
    
    it("should get activity information", () => {
      const activity = getActivity(1, contractState)
      expect(activity).toBeDefined()
      expect(activity.ageGroup).toBe("toddler")
      expect(activity.active).toBe(true)
    })
    
    it("should get session information", () => {
      const session = getSession(1, contractState)
      expect(session).toBeDefined()
      expect(session.activityId).toBe(1)
      expect(session.status).toBe("scheduled")
    })
    
    it("should check if session is full", () => {
      const isFull = isSessionFull(1, contractState)
      expect(isFull).toBe(false)
      
      // Make session full
      contractState.activitySessions.get(1).currentParticipants = 5
      const isFullNow = isSessionFull(1, contractState)
      expect(isFullNow).toBe(true)
    })
    
    it("should get available capacity", () => {
      const capacity = getAvailableCapacity(1, contractState)
      expect(capacity).toBe(2) // 5 max - 3 current
    })
    
    it("should return contract info", () => {
      const info = getContractInfo(contractState)
      expect(info.paused).toBe(false)
      expect(info.nextActivityId).toBe(1)
      expect(info.nextSessionId).toBe(1)
      expect(info.nextResourceId).toBe(1)
    })
  })
})

// Helper functions to simulate contract behavior
function createActivity(
    txSender,
    nameHash,
    descriptionHash,
    ageGroup,
    minAge,
    maxAge,
    category,
    durationMinutes,
    maxParticipants,
    requiredResources,
    safetyRequirementsHash,
    contractState,
    blockHeight,
) {
  if (contractState.contractPaused) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  if (!contractState.authorizedPlanners.get(txSender)) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  if (minAge >= maxAge || durationMinutes <= 0 || maxParticipants <= 0) {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  
  const activityId = contractState.nextActivityId
  contractState.activities.set(activityId, {
    nameHash,
    descriptionHash,
    ageGroup,
    minAge,
    maxAge,
    category,
    durationMinutes,
    maxParticipants,
    requiredResources,
    safetyRequirementsHash,
    createdBy: txSender,
    createdDate: blockHeight,
    active: true,
  })
  
  contractState.nextActivityId += 1
  return { success: true, activityId }
}

function updateActivity(
    txSender,
    activityId,
    nameHash,
    descriptionHash,
    durationMinutes,
    maxParticipants,
    safetyRequirementsHash,
    contractState,
) {
  if (!contractState.authorizedPlanners.get(txSender)) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  if (durationMinutes <= 0 || maxParticipants <= 0) {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  
  const activity = contractState.activities.get(activityId)
  if (!activity) {
    return { success: false, error: "ERR_NOT_FOUND" }
  }
  
  activity.nameHash = nameHash
  activity.descriptionHash = descriptionHash
  activity.durationMinutes = durationMinutes
  activity.maxParticipants = maxParticipants
  activity.safetyRequirementsHash = safetyRequirementsHash
  
  return { success: true }
}

function deactivateActivity(txSender, activityId, contractState) {
  if (!contractState.authorizedPlanners.get(txSender)) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  
  const activity = contractState.activities.get(activityId)
  if (!activity) {
    return { success: false, error: "ERR_NOT_FOUND" }
  }
  
  activity.active = false
  return { success: true }
}

function scheduleSession(
    txSender,
    activityId,
    scheduledDate,
    startTime,
    endTime,
    locationHash,
    caregiverId,
    maxParticipants,
    contractState,
) {
  if (!contractState.authorizedPlanners.get(txSender)) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  
  const activity = contractState.activities.get(activityId)
  if (!activity || !activity.active) {
    return { success: false, error: "ERR_NOT_FOUND" }
  }
  if (startTime >= endTime || maxParticipants <= 0 || maxParticipants > activity.maxParticipants) {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  
  const sessionId = contractState.nextSessionId
  contractState.activitySessions.set(sessionId, {
    activityId,
    scheduledDate,
    startTime,
    endTime,
    locationHash,
    caregiverId,
    currentParticipants: 0,
    maxParticipants,
    status: "scheduled",
    notesHash: null,
  })
  
  contractState.nextSessionId += 1
  return { success: true, sessionId }
}

function enrollChild(txSender, sessionId, childId, contractState, blockHeight) {
  const session = contractState.activitySessions.get(sessionId)
  if (!session || session.status !== "scheduled") {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  if (session.currentParticipants >= session.maxParticipants) {
    return { success: false, error: "ERR_CAPACITY_FULL" }
  }
  
  const participantKey = `${sessionId}-${childId}`
  if (contractState.sessionParticipants.has(participantKey)) {
    return { success: false, error: "ERR_ALREADY_EXISTS" }
  }
  
  contractState.sessionParticipants.set(participantKey, {
    enrolled: true,
    enrollmentDate: blockHeight,
    attendanceStatus: "enrolled",
    participationRating: null,
    parentFeedbackHash: null,
  })
  
  session.currentParticipants += 1
  
  // Update child sessions
  const childSessions = contractState.childSessions.get(childId) || { sessionIds: [] }
  childSessions.sessionIds.push(sessionId)
  contractState.childSessions.set(childId, childSessions)
  
  return { success: true }
}

function unenrollChild(txSender, sessionId, childId, contractState) {
  const session = contractState.activitySessions.get(sessionId)
  if (!session || session.status !== "scheduled") {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  
  const participantKey = `${sessionId}-${childId}`
  const participant = contractState.sessionParticipants.get(participantKey)
  if (!participant || !participant.enrolled) {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  
  participant.enrolled = false
  participant.attendanceStatus = "unenrolled"
  session.currentParticipants -= 1
  
  return { success: true }
}

function markAttendance(txSender, sessionId, childId, attendanceStatus, contractState) {
  if (!contractState.authorizedPlanners.get(txSender)) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  
  const participantKey = `${sessionId}-${childId}`
  const participant = contractState.sessionParticipants.get(participantKey)
  if (!participant || !participant.enrolled) {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  
  participant.attendanceStatus = attendanceStatus
  return { success: true }
}

function rateParticipation(txSender, sessionId, childId, rating, feedbackHash, contractState) {
  if (rating < 1 || rating > 5) {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  
  const participantKey = `${sessionId}-${childId}`
  const participant = contractState.sessionParticipants.get(participantKey)
  if (!participant) {
    return { success: false, error: "ERR_NOT_FOUND" }
  }
  
  participant.participationRating = rating
  participant.parentFeedbackHash = feedbackHash
  return { success: true }
}

function addResource(
    txSender,
    nameHash,
    descriptionHash,
    resourceType,
    quantityAvailable,
    locationHash,
    contractState,
) {
  if (!contractState.authorizedPlanners.get(txSender)) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  if (quantityAvailable <= 0) {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  
  const resourceId = contractState.nextResourceId
  contractState.activityResources.set(resourceId, {
    nameHash,
    descriptionHash,
    resourceType,
    quantityAvailable,
    quantityReserved: 0,
    locationHash,
    maintenanceDate: null,
    status: "available",
  })
  
  contractState.nextResourceId += 1
  return { success: true, resourceId }
}

function reserveResource(txSender, sessionId, resourceId, quantity, contractState, blockHeight) {
  if (!contractState.authorizedPlanners.get(txSender)) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  
  const resource = contractState.activityResources.get(resourceId)
  if (!resource || resource.status !== "available") {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  
  const availableQuantity = resource.quantityAvailable - resource.quantityReserved
  if (availableQuantity < quantity) {
    return { success: false, error: "ERR_CAPACITY_FULL" }
  }
  
  const reservationKey = `${sessionId}-${resourceId}`
  contractState.resourceReservations.set(reservationKey, {
    quantityReserved: quantity,
    reservationDate: blockHeight,
    status: "reserved",
  })
  
  resource.quantityReserved += quantity
  return { success: true }
}

function getActivity(activityId, contractState) {
  return contractState.activities.get(activityId)
}

function getSession(sessionId, contractState) {
  return contractState.activitySessions.get(sessionId)
}

function isSessionFull(sessionId, contractState) {
  const session = contractState.activitySessions.get(sessionId)
  if (!session) return false
  return session.currentParticipants >= session.maxParticipants
}

function getAvailableCapacity(sessionId, contractState) {
  const session = contractState.activitySessions.get(sessionId)
  if (!session) return 0
  return session.maxParticipants - session.currentParticipants
}

function getContractInfo(contractState) {
  return {
    paused: contractState.contractPaused,
    nextActivityId: contractState.nextActivityId,
    nextSessionId: contractState.nextSessionId,
    nextResourceId: contractState.nextResourceId,
  }
}
