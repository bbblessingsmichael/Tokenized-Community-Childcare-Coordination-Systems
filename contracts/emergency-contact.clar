;; Emergency Contact Contract
;; Manages rapid parent notification systems

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u200))
(define-constant ERR_NOT_FOUND (err u201))
(define-constant ERR_ALREADY_EXISTS (err u202))
(define-constant ERR_INVALID_INPUT (err u203))
(define-constant ERR_EMERGENCY_ACTIVE (err u204))

;; Data Variables
(define-data-var contract-paused bool false)
(define-data-var emergency-active bool false)
(define-data-var next-contact-id uint u1)
(define-data-var next-emergency-id uint u1)

;; Data Maps
(define-map emergency-contacts
  { contact-id: uint }
  {
    parent-principal: principal,
    child-id: uint,
    primary-contact-hash: (buff 32),
    secondary-contact-hash: (buff 32),
    medical-contact-hash: (buff 32),
    emergency-instructions-hash: (buff 32),
    created-date: uint,
    last-updated: uint,
    active: bool
  }
)

(define-map parent-contacts
  { parent: principal }
  { contact-ids: (list 10 uint) }
)

(define-map child-contacts
  { child-id: uint }
  { contact-id: uint }
)

(define-map emergency-alerts
  { emergency-id: uint }
  {
    child-id: uint,
    alert-type: (string-ascii 50),
    severity: uint,
    description-hash: (buff 32),
    location-hash: (buff 32),
    initiated-by: principal,
    initiated-date: uint,
    status: (string-ascii 20),
    resolved-date: (optional uint),
    response-time: (optional uint)
  }
)

(define-map alert-notifications
  { emergency-id: uint, contact-id: uint }
  {
    notification-sent: bool,
    notification-time: (optional uint),
    acknowledgment-time: (optional uint),
    response-method: (optional (string-ascii 20))
  }
)

(define-map authorized-responders
  { responder: principal }
  { authorized: bool }
)

;; Authorization Functions
(define-private (is-contract-owner)
  (is-eq tx-sender CONTRACT_OWNER)
)

(define-private (is-authorized-responder)
  (default-to false (get authorized (map-get? authorized-responders { responder: tx-sender })))
)

(define-private (is-contract-active)
  (not (var-get contract-paused))
)

;; Admin Functions
(define-public (pause-contract)
  (begin
    (asserts! (is-contract-owner) ERR_UNAUTHORIZED)
    (var-set contract-paused true)
    (ok true)
  )
)

(define-public (unpause-contract)
  (begin
    (asserts! (is-contract-owner) ERR_UNAUTHORIZED)
    (var-set contract-paused false)
    (ok true)
  )
)

(define-public (add-authorized-responder (responder principal))
  (begin
    (asserts! (is-contract-owner) ERR_UNAUTHORIZED)
    (map-set authorized-responders { responder: responder } { authorized: true })
    (ok true)
  )
)

(define-public (remove-authorized-responder (responder principal))
  (begin
    (asserts! (is-contract-owner) ERR_UNAUTHORIZED)
    (map-set authorized-responders { responder: responder } { authorized: false })
    (ok true)
  )
)

;; Contact Management Functions
(define-public (register-emergency-contact
  (child-id uint)
  (primary-contact-hash (buff 32))
  (secondary-contact-hash (buff 32))
  (medical-contact-hash (buff 32))
  (emergency-instructions-hash (buff 32)))
  (let
    (
      (contact-id (var-get next-contact-id))
      (current-block block-height)
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-none (map-get? child-contacts { child-id: child-id })) ERR_ALREADY_EXISTS)

    ;; Create emergency contact record
    (map-set emergency-contacts
      { contact-id: contact-id }
      {
        parent-principal: tx-sender,
        child-id: child-id,
        primary-contact-hash: primary-contact-hash,
        secondary-contact-hash: secondary-contact-hash,
        medical-contact-hash: medical-contact-hash,
        emergency-instructions-hash: emergency-instructions-hash,
        created-date: current-block,
        last-updated: current-block,
        active: true
      }
    )

    ;; Map child to contact
    (map-set child-contacts
      { child-id: child-id }
      { contact-id: contact-id }
    )

    ;; Update parent contact list
    (let
      (
        (current-contacts (default-to (list) (get contact-ids (map-get? parent-contacts { parent: tx-sender }))))
        (updated-contacts (unwrap! (as-max-len? (append current-contacts contact-id) u10) ERR_INVALID_INPUT))
      )
      (map-set parent-contacts
        { parent: tx-sender }
        { contact-ids: updated-contacts }
      )
    )

    ;; Increment contact ID
    (var-set next-contact-id (+ contact-id u1))

    (ok contact-id)
  )
)

(define-public (update-emergency-contact
  (contact-id uint)
  (primary-contact-hash (buff 32))
  (secondary-contact-hash (buff 32))
  (medical-contact-hash (buff 32))
  (emergency-instructions-hash (buff 32)))
  (let
    (
      (contact (unwrap! (map-get? emergency-contacts { contact-id: contact-id }) ERR_NOT_FOUND))
      (current-block block-height)
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-eq tx-sender (get parent-principal contact)) ERR_UNAUTHORIZED)

    ;; Update contact information
    (map-set emergency-contacts
      { contact-id: contact-id }
      (merge contact {
        primary-contact-hash: primary-contact-hash,
        secondary-contact-hash: secondary-contact-hash,
        medical-contact-hash: medical-contact-hash,
        emergency-instructions-hash: emergency-instructions-hash,
        last-updated: current-block
      })
    )

    (ok true)
  )
)

(define-public (deactivate-emergency-contact (contact-id uint))
  (let
    (
      (contact (unwrap! (map-get? emergency-contacts { contact-id: contact-id }) ERR_NOT_FOUND))
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-eq tx-sender (get parent-principal contact)) ERR_UNAUTHORIZED)

    ;; Deactivate contact
    (map-set emergency-contacts
      { contact-id: contact-id }
      (merge contact { active: false })
    )

    (ok true)
  )
)

;; Emergency Alert Functions
(define-public (initiate-emergency-alert
  (child-id uint)
  (alert-type (string-ascii 50))
  (severity uint)
  (description-hash (buff 32))
  (location-hash (buff 32)))
  (let
    (
      (emergency-id (var-get next-emergency-id))
      (current-block block-height)
      (contact-data (unwrap! (map-get? child-contacts { child-id: child-id }) ERR_NOT_FOUND))
      (contact-id (get contact-id contact-data))
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-authorized-responder) ERR_UNAUTHORIZED)
    (asserts! (<= severity u5) ERR_INVALID_INPUT)
    (asserts! (>= severity u1) ERR_INVALID_INPUT)

    ;; Create emergency alert
    (map-set emergency-alerts
      { emergency-id: emergency-id }
      {
        child-id: child-id,
        alert-type: alert-type,
        severity: severity,
        description-hash: description-hash,
        location-hash: location-hash,
        initiated-by: tx-sender,
        initiated-date: current-block,
        status: "active",
        resolved-date: none,
        response-time: none
      }
    )

    ;; Initialize notification tracking
    (map-set alert-notifications
      { emergency-id: emergency-id, contact-id: contact-id }
      {
        notification-sent: true,
        notification-time: (some current-block),
        acknowledgment-time: none,
        response-method: none
      }
    )

    ;; Set emergency active flag
    (var-set emergency-active true)

    ;; Increment emergency ID
    (var-set next-emergency-id (+ emergency-id u1))

    (ok emergency-id)
  )
)

(define-public (acknowledge-emergency-alert (emergency-id uint) (contact-id uint) (response-method (string-ascii 20)))
  (let
    (
      (alert (unwrap! (map-get? emergency-alerts { emergency-id: emergency-id }) ERR_NOT_FOUND))
      (notification (unwrap! (map-get? alert-notifications { emergency-id: emergency-id, contact-id: contact-id }) ERR_NOT_FOUND))
      (current-block block-height)
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-eq (get status alert) "active") ERR_INVALID_INPUT)

    ;; Update notification acknowledgment
    (map-set alert-notifications
      { emergency-id: emergency-id, contact-id: contact-id }
      (merge notification {
        acknowledgment-time: (some current-block),
        response-method: (some response-method)
      })
    )

    (ok true)
  )
)

(define-public (resolve-emergency-alert (emergency-id uint))
  (let
    (
      (alert (unwrap! (map-get? emergency-alerts { emergency-id: emergency-id }) ERR_NOT_FOUND))
      (current-block block-height)
      (response-time (- current-block (get initiated-date alert)))
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-authorized-responder) ERR_UNAUTHORIZED)
    (asserts! (is-eq (get status alert) "active") ERR_INVALID_INPUT)

    ;; Update alert status
    (map-set emergency-alerts
      { emergency-id: emergency-id }
      (merge alert {
        status: "resolved",
        resolved-date: (some current-block),
        response-time: (some response-time)
      })
    )

    ;; Clear emergency active flag if no other active emergencies
    (var-set emergency-active false)

    (ok response-time)
  )
)

(define-public (escalate-emergency-alert (emergency-id uint) (new-severity uint))
  (let
    (
      (alert (unwrap! (map-get? emergency-alerts { emergency-id: emergency-id }) ERR_NOT_FOUND))
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-authorized-responder) ERR_UNAUTHORIZED)
    (asserts! (is-eq (get status alert) "active") ERR_INVALID_INPUT)
    (asserts! (<= new-severity u5) ERR_INVALID_INPUT)
    (asserts! (> new-severity (get severity alert)) ERR_INVALID_INPUT)

    ;; Update alert severity
    (map-set emergency-alerts
      { emergency-id: emergency-id }
      (merge alert { severity: new-severity })
    )

    (ok true)
  )
)

;; Read-only Functions
(define-read-only (get-emergency-contact (contact-id uint))
  (map-get? emergency-contacts { contact-id: contact-id })
)

(define-read-only (get-contact-by-child (child-id uint))
  (match (map-get? child-contacts { child-id: child-id })
    contact-data (map-get? emergency-contacts { contact-id: (get contact-id contact-data) })
    none
  )
)

(define-read-only (get-parent-contacts (parent principal))
  (map-get? parent-contacts { parent: parent })
)

(define-read-only (get-emergency-alert (emergency-id uint))
  (map-get? emergency-alerts { emergency-id: emergency-id })
)

(define-read-only (get-alert-notification (emergency-id uint) (contact-id uint))
  (map-get? alert-notifications { emergency-id: emergency-id, contact-id: contact-id })
)

(define-read-only (is-emergency-active)
  (var-get emergency-active)
)

(define-read-only (get-contract-info)
  {
    paused: (var-get contract-paused),
    emergency-active: (var-get emergency-active),
    next-contact-id: (var-get next-contact-id),
    next-emergency-id: (var-get next-emergency-id)
  }
)
