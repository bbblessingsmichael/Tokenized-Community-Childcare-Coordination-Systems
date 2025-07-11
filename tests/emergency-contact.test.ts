import { describe, it, expect, beforeEach } from "vitest"

describe("Emergency Contact Contract", () => {
  let contractState
  let mockTxSender
  let mockBlockHeight
  
  beforeEach(() => {
    contractState = {
      contractPaused: false,
      emergencyActive: false,
      nextContactId: 1,
      nextEmergencyId: 1,
      emergencyContacts: new Map(),
      parentContacts: new Map(),
      childContacts: new Map(),
      emergencyAlerts: new Map(),
      alertNotifications: new Map(),
      authorizedResponders: new Map(),
    }
    
    mockTxSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    mockBlockHeight = 1000
  })
  
  describe("Emergency Contact Registration", () => {
    it("should register emergency contact successfully", () => {
      const childId = 1
      const primaryContactHash = new Uint8Array(32).fill(1)
      const secondaryContactHash = new Uint8Array(32).fill(2)
      const medicalContactHash = new Uint8Array(32).fill(3)
      const emergencyInstructionsHash = new Uint8Array(32).fill(4)
      
      const result = registerEmergencyContact(
          mockTxSender,
          childId,
          primaryContactHash,
          secondaryContactHash,
          medicalContactHash,
          emergencyInstructionsHash,
          contractState,
          mockBlockHeight,
      )
      
      expect(result.success).toBe(true)
      expect(result.contactId).toBe(1)
      expect(contractState.nextContactId).toBe(2)
      
      const contact = contractState.emergencyContacts.get(1)
      expect(contact.parentPrincipal).toBe(mockTxSender)
      expect(contact.childId).toBe(childId)
      expect(contact.active).toBe(true)
    })
    
    it("should prevent duplicate contact registration for same child", () => {
      const childId = 1
      const primaryContactHash = new Uint8Array(32).fill(1)
      const secondaryContactHash = new Uint8Array(32).fill(2)
      const medicalContactHash = new Uint8Array(32).fill(3)
      const emergencyInstructionsHash = new Uint8Array(32).fill(4)
      
      // First registration
      registerEmergencyContact(
          mockTxSender,
          childId,
          primaryContactHash,
          secondaryContactHash,
          medicalContactHash,
          emergencyInstructionsHash,
          contractState,
          mockBlockHeight,
      )
      
      // Second registration should fail
      const result = registerEmergencyContact(
          mockTxSender,
          childId,
          primaryContactHash,
          secondaryContactHash,
          medicalContactHash,
          emergencyInstructionsHash,
          contractState,
          mockBlockHeight,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_ALREADY_EXISTS")
    })
    
    it("should update parent contact list", () => {
      const childId = 1
      const primaryContactHash = new Uint8Array(32).fill(1)
      const secondaryContactHash = new Uint8Array(32).fill(2)
      const medicalContactHash = new Uint8Array(32).fill(3)
      const emergencyInstructionsHash = new Uint8Array(32).fill(4)
      
      registerEmergencyContact(
          mockTxSender,
          childId,
          primaryContactHash,
          secondaryContactHash,
          medicalContactHash,
          emergencyInstructionsHash,
          contractState,
          mockBlockHeight,
      )
      
      const parentContacts = contractState.parentContacts.get(mockTxSender)
      expect(parentContacts.contactIds).toContain(1)
    })
  })
  
  describe("Emergency Contact Updates", () => {
    beforeEach(() => {
      // Create initial contact
      contractState.emergencyContacts.set(1, {
        parentPrincipal: mockTxSender,
        childId: 1,
        primaryContactHash: new Uint8Array(32).fill(1),
        secondaryContactHash: new Uint8Array(32).fill(2),
        medicalContactHash: new Uint8Array(32).fill(3),
        emergencyInstructionsHash: new Uint8Array(32).fill(4),
        createdDate: mockBlockHeight,
        lastUpdated: mockBlockHeight,
        active: true,
      })
    })
    
    it("should allow parent to update emergency contact", () => {
      const newPrimaryContactHash = new Uint8Array(32).fill(5)
      const newSecondaryContactHash = new Uint8Array(32).fill(6)
      const newMedicalContactHash = new Uint8Array(32).fill(7)
      const newEmergencyInstructionsHash = new Uint8Array(32).fill(8)
      
      const result = updateEmergencyContact(
          mockTxSender,
          1,
          newPrimaryContactHash,
          newSecondaryContactHash,
          newMedicalContactHash,
          newEmergencyInstructionsHash,
          contractState,
          mockBlockHeight + 100,
      )
      
      expect(result.success).toBe(true)
      
      const contact = contractState.emergencyContacts.get(1)
      expect(contact.primaryContactHash).toEqual(newPrimaryContactHash)
      expect(contact.lastUpdated).toBe(mockBlockHeight + 100)
    })
    
    it("should prevent unauthorized updates", () => {
      const unauthorizedUser = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"
      const newPrimaryContactHash = new Uint8Array(32).fill(5)
      const newSecondaryContactHash = new Uint8Array(32).fill(6)
      const newMedicalContactHash = new Uint8Array(32).fill(7)
      const newEmergencyInstructionsHash = new Uint8Array(32).fill(8)
      
      const result = updateEmergencyContact(
          unauthorizedUser,
          1,
          newPrimaryContactHash,
          newSecondaryContactHash,
          newMedicalContactHash,
          newEmergencyInstructionsHash,
          contractState,
          mockBlockHeight + 100,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_UNAUTHORIZED")
    })
    
    it("should allow deactivating emergency contact", () => {
      const result = deactivateEmergencyContact(mockTxSender, 1, contractState)
      
      expect(result.success).toBe(true)
      
      const contact = contractState.emergencyContacts.get(1)
      expect(contact.active).toBe(false)
    })
  })
  
  describe("Emergency Alert Management", () => {
    beforeEach(() => {
      // Add authorized responder
      contractState.authorizedResponders.set(mockTxSender, true)
      
      // Create child contact mapping
      contractState.childContacts.set(1, { contactId: 1 })
      
      // Create emergency contact
      contractState.emergencyContacts.set(1, {
        parentPrincipal: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
        childId: 1,
        primaryContactHash: new Uint8Array(32).fill(1),
        secondaryContactHash: new Uint8Array(32).fill(2),
        medicalContactHash: new Uint8Array(32).fill(3),
        emergencyInstructionsHash: new Uint8Array(32).fill(4),
        createdDate: mockBlockHeight,
        lastUpdated: mockBlockHeight,
        active: true,
      })
    })
    
    it("should initiate emergency alert successfully", () => {
      const childId = 1
      const alertType = "medical"
      const severity = 4
      const descriptionHash = new Uint8Array(32).fill(5)
      const locationHash = new Uint8Array(32).fill(6)
      
      const result = initiateEmergencyAlert(
          mockTxSender,
          childId,
          alertType,
          severity,
          descriptionHash,
          locationHash,
          contractState,
          mockBlockHeight,
      )
      
      expect(result.success).toBe(true)
      expect(result.emergencyId).toBe(1)
      expect(contractState.emergencyActive).toBe(true)
      
      const alert = contractState.emergencyAlerts.get(1)
      expect(alert.childId).toBe(childId)
      expect(alert.alertType).toBe(alertType)
      expect(alert.severity).toBe(severity)
      expect(alert.status).toBe("active")
    })
    
    it("should prevent unauthorized users from initiating alerts", () => {
      const unauthorizedUser = "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP"
      const result = initiateEmergencyAlert(
          unauthorizedUser,
          1,
          "medical",
          4,
          new Uint8Array(32).fill(5),
          new Uint8Array(32).fill(6),
          contractState,
          mockBlockHeight,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_UNAUTHORIZED")
    })
    
    it("should validate severity levels", () => {
      const result = initiateEmergencyAlert(
          mockTxSender,
          1,
          "medical",
          6, // Invalid severity > 5
          new Uint8Array(32).fill(5),
          new Uint8Array(32).fill(6),
          contractState,
          mockBlockHeight,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_INVALID_INPUT")
    })
    
    it("should create notification tracking", () => {
      initiateEmergencyAlert(
          mockTxSender,
          1,
          "medical",
          4,
          new Uint8Array(32).fill(5),
          new Uint8Array(32).fill(6),
          contractState,
          mockBlockHeight,
      )
      
      const notification = contractState.alertNotifications.get("1-1") // emergencyId-contactId
      expect(notification.notificationSent).toBe(true)
      expect(notification.notificationTime).toBe(mockBlockHeight)
    })
  })
  
  describe("Emergency Alert Response", () => {
    beforeEach(() => {
      // Setup emergency alert
      contractState.authorizedResponders.set(mockTxSender, true)
      contractState.emergencyActive = true
      contractState.emergencyAlerts.set(1, {
        childId: 1,
        alertType: "medical",
        severity: 4,
        descriptionHash: new Uint8Array(32).fill(5),
        locationHash: new Uint8Array(32).fill(6),
        initiatedBy: mockTxSender,
        initiatedDate: mockBlockHeight,
        status: "active",
        resolvedDate: null,
        responseTime: null,
      })
      
      contractState.alertNotifications.set("1-1", {
        notificationSent: true,
        notificationTime: mockBlockHeight,
        acknowledgmentTime: null,
        responseMethod: null,
      })
    })
    
    it("should acknowledge emergency alert", () => {
      const result = acknowledgeEmergencyAlert(mockTxSender, 1, 1, "phone", contractState, mockBlockHeight + 50)
      
      expect(result.success).toBe(true)
      
      const notification = contractState.alertNotifications.get("1-1")
      expect(notification.acknowledgmentTime).toBe(mockBlockHeight + 50)
      expect(notification.responseMethod).toBe("phone")
    })
    
    it("should resolve emergency alert", () => {
      const result = resolveEmergencyAlert(mockTxSender, 1, contractState, mockBlockHeight + 100)
      
      expect(result.success).toBe(true)
      expect(result.responseTime).toBe(100)
      expect(contractState.emergencyActive).toBe(false)
      
      const alert = contractState.emergencyAlerts.get(1)
      expect(alert.status).toBe("resolved")
      expect(alert.resolvedDate).toBe(mockBlockHeight + 100)
      expect(alert.responseTime).toBe(100)
    })
    
    it("should escalate emergency alert", () => {
      const result = escalateEmergencyAlert(mockTxSender, 1, 5, contractState)
      
      expect(result.success).toBe(true)
      
      const alert = contractState.emergencyAlerts.get(1)
      expect(alert.severity).toBe(5)
    })
    
    it("should prevent escalation to lower severity", () => {
      const result = escalateEmergencyAlert(
          mockTxSender,
          1,
          3, // Lower than current severity of 4
          contractState,
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR_INVALID_INPUT")
    })
  })
  
  describe("Read-only Functions", () => {
    beforeEach(() => {
      contractState.emergencyContacts.set(1, {
        parentPrincipal: mockTxSender,
        childId: 1,
        primaryContactHash: new Uint8Array(32).fill(1),
        secondaryContactHash: new Uint8Array(32).fill(2),
        medicalContactHash: new Uint8Array(32).fill(3),
        emergencyInstructionsHash: new Uint8Array(32).fill(4),
        createdDate: mockBlockHeight,
        lastUpdated: mockBlockHeight,
        active: true,
      })
      
      contractState.childContacts.set(1, { contactId: 1 })
    })
    
    it("should get emergency contact by ID", () => {
      const contact = getEmergencyContact(1, contractState)
      expect(contact).toBeDefined()
      expect(contact.childId).toBe(1)
      expect(contact.active).toBe(true)
    })
    
    it("should get contact by child ID", () => {
      const contact = getContactByChild(1, contractState)
      expect(contact).toBeDefined()
      expect(contact.childId).toBe(1)
    })
    
    it("should return contract info", () => {
      const info = getContractInfo(contractState)
      expect(info.paused).toBe(false)
      expect(info.emergencyActive).toBe(false)
      expect(info.nextContactId).toBe(1)
      expect(info.nextEmergencyId).toBe(1)
    })
  })
})

// Helper functions to simulate contract behavior
function registerEmergencyContact(
    txSender,
    childId,
    primaryContactHash,
    secondaryContactHash,
    medicalContactHash,
    emergencyInstructionsHash,
    contractState,
    blockHeight,
) {
  if (contractState.contractPaused) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  if (contractState.childContacts.has(childId)) {
    return { success: false, error: "ERR_ALREADY_EXISTS" }
  }
  
  const contactId = contractState.nextContactId
  contractState.emergencyContacts.set(contactId, {
    parentPrincipal: txSender,
    childId,
    primaryContactHash,
    secondaryContactHash,
    medicalContactHash,
    emergencyInstructionsHash,
    createdDate: blockHeight,
    lastUpdated: blockHeight,
    active: true,
  })
  
  contractState.childContacts.set(childId, { contactId })
  
  // Update parent contact list
  const currentContacts = contractState.parentContacts.get(txSender) || { contactIds: [] }
  currentContacts.contactIds.push(contactId)
  contractState.parentContacts.set(txSender, currentContacts)
  
  contractState.nextContactId += 1
  
  return { success: true, contactId }
}

function updateEmergencyContact(
    txSender,
    contactId,
    primaryContactHash,
    secondaryContactHash,
    medicalContactHash,
    emergencyInstructionsHash,
    contractState,
    blockHeight,
) {
  const contact = contractState.emergencyContacts.get(contactId)
  if (!contact) {
    return { success: false, error: "ERR_NOT_FOUND" }
  }
  if (contact.parentPrincipal !== txSender) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  
  contact.primaryContactHash = primaryContactHash
  contact.secondaryContactHash = secondaryContactHash
  contact.medicalContactHash = medicalContactHash
  contact.emergencyInstructionsHash = emergencyInstructionsHash
  contact.lastUpdated = blockHeight
  
  return { success: true }
}

function deactivateEmergencyContact(txSender, contactId, contractState) {
  const contact = contractState.emergencyContacts.get(contactId)
  if (!contact) {
    return { success: false, error: "ERR_NOT_FOUND" }
  }
  if (contact.parentPrincipal !== txSender) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  
  contact.active = false
  return { success: true }
}

function initiateEmergencyAlert(
    txSender,
    childId,
    alertType,
    severity,
    descriptionHash,
    locationHash,
    contractState,
    blockHeight,
) {
  if (contractState.contractPaused) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  if (!contractState.authorizedResponders.get(txSender)) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  if (severity < 1 || severity > 5) {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  
  const contactData = contractState.childContacts.get(childId)
  if (!contactData) {
    return { success: false, error: "ERR_NOT_FOUND" }
  }
  
  const emergencyId = contractState.nextEmergencyId
  contractState.emergencyAlerts.set(emergencyId, {
    childId,
    alertType,
    severity,
    descriptionHash,
    locationHash,
    initiatedBy: txSender,
    initiatedDate: blockHeight,
    status: "active",
    resolvedDate: null,
    responseTime: null,
  })
  
  // Initialize notification tracking
  contractState.alertNotifications.set(`${emergencyId}-${contactData.contactId}`, {
    notificationSent: true,
    notificationTime: blockHeight,
    acknowledgmentTime: null,
    responseMethod: null,
  })
  
  contractState.emergencyActive = true
  contractState.nextEmergencyId += 1
  
  return { success: true, emergencyId }
}

function acknowledgeEmergencyAlert(txSender, emergencyId, contactId, responseMethod, contractState, blockHeight) {
  const alert = contractState.emergencyAlerts.get(emergencyId)
  if (!alert || alert.status !== "active") {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  
  const notification = contractState.alertNotifications.get(`${emergencyId}-${contactId}`)
  if (!notification) {
    return { success: false, error: "ERR_NOT_FOUND" }
  }
  
  notification.acknowledgmentTime = blockHeight
  notification.responseMethod = responseMethod
  
  return { success: true }
}

function resolveEmergencyAlert(txSender, emergencyId, contractState, blockHeight) {
  if (!contractState.authorizedResponders.get(txSender)) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  
  const alert = contractState.emergencyAlerts.get(emergencyId)
  if (!alert || alert.status !== "active") {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  
  const responseTime = blockHeight - alert.initiatedDate
  alert.status = "resolved"
  alert.resolvedDate = blockHeight
  alert.responseTime = responseTime
  
  contractState.emergencyActive = false
  
  return { success: true, responseTime }
}

function escalateEmergencyAlert(txSender, emergencyId, newSeverity, contractState) {
  if (!contractState.authorizedResponders.get(txSender)) {
    return { success: false, error: "ERR_UNAUTHORIZED" }
  }
  
  const alert = contractState.emergencyAlerts.get(emergencyId)
  if (!alert || alert.status !== "active") {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  if (newSeverity < 1 || newSeverity > 5 || newSeverity <= alert.severity) {
    return { success: false, error: "ERR_INVALID_INPUT" }
  }
  
  alert.severity = newSeverity
  return { success: true }
}

function getEmergencyContact(contactId, contractState) {
  return contractState.emergencyContacts.get(contactId)
}

function getContactByChild(childId, contractState) {
  const contactData = contractState.childContacts.get(childId)
  if (!contactData) return null
  return contractState.emergencyContacts.get(contactData.contactId)
}

function getContractInfo(contractState) {
  return {
    paused: contractState.contractPaused,
    emergencyActive: contractState.emergencyActive,
    nextContactId: contractState.nextContactId,
    nextEmergencyId: contractState.nextEmergencyId,
  }
}
