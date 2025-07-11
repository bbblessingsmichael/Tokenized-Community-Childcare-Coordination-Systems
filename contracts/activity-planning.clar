;; Activity Planning Contract
;; Coordinates age-appropriate learning and play experiences

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u300))
(define-constant ERR_NOT_FOUND (err u301))
(define-constant ERR_ALREADY_EXISTS (err u302))
(define-constant ERR_INVALID_INPUT (err u303))
(define-constant ERR_CAPACITY_FULL (err u304))
(define-constant ERR_TIME_CONFLICT (err u305))

;; Data Variables
(define-data-var contract-paused bool false)
(define-data-var next-activity-id uint u1)
(define-data-var next-session-id uint u1)
(define-data-var next-resource-id uint u1)

;; Data Maps
(define-map activities
  { activity-id: uint }
  {
    name-hash: (buff 32),
    description-hash: (buff 32),
    age-group: (string-ascii 20),
    min-age: uint,
    max-age: uint,
    category: (string-ascii 30),
    duration-minutes: uint,
    max-participants: uint,
    required-resources: (list 5 uint),
    safety-requirements-hash: (buff 32),
    created-by: principal,
    created-date: uint,
    active: bool
  }
)

(define-map activity-sessions
  { session-id: uint }
  {
    activity-id: uint,
    scheduled-date: uint,
    start-time: uint,
    end-time: uint,
    location-hash: (buff 32),
    caregiver-id: uint,
    current-participants: uint,
    max-participants: uint,
    status: (string-ascii 20),
    notes-hash: (optional (buff 32))
  }
)

(define-map session-participants
  { session-id: uint, child-id: uint }
  {
    enrolled: bool,
    enrollment-date: uint,
    attendance-status: (string-ascii 20),
    participation-rating: (optional uint),
    parent-feedback-hash: (optional (buff 32))
  }
)

(define-map child-sessions
  { child-id: uint }
  { session-ids: (list 20 uint) }
)

(define-map activity-resources
  { resource-id: uint }
  {
    name-hash: (buff 32),
    description-hash: (buff 32),
    resource-type: (string-ascii 30),
    quantity-available: uint,
    quantity-reserved: uint,
    location-hash: (buff 32),
    maintenance-date: (optional uint),
    status: (string-ascii 20)
  }
)

(define-map resource-reservations
  { session-id: uint, resource-id: uint }
  {
    quantity-reserved: uint,
    reservation-date: uint,
    status: (string-ascii 20)
  }
)

(define-map authorized-planners
  { planner: principal }
  { authorized: bool }
)

;; Authorization Functions
(define-private (is-contract-owner)
  (is-eq tx-sender CONTRACT_OWNER)
)

(define-private (is-authorized-planner)
  (default-to false (get authorized (map-get? authorized-planners { planner: tx-sender })))
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

(define-public (add-authorized-planner (planner principal))
  (begin
    (asserts! (is-contract-owner) ERR_UNAUTHORIZED)
    (map-set authorized-planners { planner: planner } { authorized: true })
    (ok true)
  )
)

(define-public (remove-authorized-planner (planner principal))
  (begin
    (asserts! (is-contract-owner) ERR_UNAUTHORIZED)
    (map-set authorized-planners { planner: planner } { authorized: false })
    (ok true)
  )
)

;; Activity Management Functions
(define-public (create-activity
  (name-hash (buff 32))
  (description-hash (buff 32))
  (age-group (string-ascii 20))
  (min-age uint)
  (max-age uint)
  (category (string-ascii 30))
  (duration-minutes uint)
  (max-participants uint)
  (required-resources (list 5 uint))
  (safety-requirements-hash (buff 32)))
  (let
    (
      (activity-id (var-get next-activity-id))
      (current-block block-height)
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-authorized-planner) ERR_UNAUTHORIZED)
    (asserts! (< min-age max-age) ERR_INVALID_INPUT)
    (asserts! (> duration-minutes u0) ERR_INVALID_INPUT)
    (asserts! (> max-participants u0) ERR_INVALID_INPUT)

    ;; Create activity record
    (map-set activities
      { activity-id: activity-id }
      {
        name-hash: name-hash,
        description-hash: description-hash,
        age-group: age-group,
        min-age: min-age,
        max-age: max-age,
        category: category,
        duration-minutes: duration-minutes,
        max-participants: max-participants,
        required-resources: required-resources,
        safety-requirements-hash: safety-requirements-hash,
        created-by: tx-sender,
        created-date: current-block,
        active: true
      }
    )

    ;; Increment activity ID
    (var-set next-activity-id (+ activity-id u1))

    (ok activity-id)
  )
)

(define-public (update-activity
  (activity-id uint)
  (name-hash (buff 32))
  (description-hash (buff 32))
  (duration-minutes uint)
  (max-participants uint)
  (safety-requirements-hash (buff 32)))
  (let
    (
      (activity (unwrap! (map-get? activities { activity-id: activity-id }) ERR_NOT_FOUND))
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-authorized-planner) ERR_UNAUTHORIZED)
    (asserts! (> duration-minutes u0) ERR_INVALID_INPUT)
    (asserts! (> max-participants u0) ERR_INVALID_INPUT)

    ;; Update activity record
    (map-set activities
      { activity-id: activity-id }
      (merge activity {
        name-hash: name-hash,
        description-hash: description-hash,
        duration-minutes: duration-minutes,
        max-participants: max-participants,
        safety-requirements-hash: safety-requirements-hash
      })
    )

    (ok true)
  )
)

(define-public (deactivate-activity (activity-id uint))
  (let
    (
      (activity (unwrap! (map-get? activities { activity-id: activity-id }) ERR_NOT_FOUND))
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-authorized-planner) ERR_UNAUTHORIZED)

    ;; Deactivate activity
    (map-set activities
      { activity-id: activity-id }
      (merge activity { active: false })
    )

    (ok true)
  )
)

;; Session Management Functions
(define-public (schedule-session
  (activity-id uint)
  (scheduled-date uint)
  (start-time uint)
  (end-time uint)
  (location-hash (buff 32))
  (caregiver-id uint)
  (max-participants uint))
  (let
    (
      (session-id (var-get next-session-id))
      (activity (unwrap! (map-get? activities { activity-id: activity-id }) ERR_NOT_FOUND))
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-authorized-planner) ERR_UNAUTHORIZED)
    (asserts! (get active activity) ERR_INVALID_INPUT)
    (asserts! (< start-time end-time) ERR_INVALID_INPUT)
    (asserts! (> max-participants u0) ERR_INVALID_INPUT)
    (asserts! (<= max-participants (get max-participants activity)) ERR_INVALID_INPUT)

    ;; Create session record
    (map-set activity-sessions
      { session-id: session-id }
      {
        activity-id: activity-id,
        scheduled-date: scheduled-date,
        start-time: start-time,
        end-time: end-time,
        location-hash: location-hash,
        caregiver-id: caregiver-id,
        current-participants: u0,
        max-participants: max-participants,
        status: "scheduled",
        notes-hash: none
      }
    )

    ;; Increment session ID
    (var-set next-session-id (+ session-id u1))

    (ok session-id)
  )
)

(define-public (enroll-child (session-id uint) (child-id uint))
  (let
    (
      (session (unwrap! (map-get? activity-sessions { session-id: session-id }) ERR_NOT_FOUND))
      (current-block block-height)
      (current-participants (get current-participants session))
      (max-participants (get max-participants session))
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-eq (get status session) "scheduled") ERR_INVALID_INPUT)
    (asserts! (< current-participants max-participants) ERR_CAPACITY_FULL)
    (asserts! (is-none (map-get? session-participants { session-id: session-id, child-id: child-id })) ERR_ALREADY_EXISTS)

    ;; Add child to session
    (map-set session-participants
      { session-id: session-id, child-id: child-id }
      {
        enrolled: true,
        enrollment-date: current-block,
        attendance-status: "enrolled",
        participation-rating: none,
        parent-feedback-hash: none
      }
    )

    ;; Update session participant count
    (map-set activity-sessions
      { session-id: session-id }
      (merge session { current-participants: (+ current-participants u1) })
    )

    ;; Update child session list
    (let
      (
        (current-sessions (default-to (list) (get session-ids (map-get? child-sessions { child-id: child-id }))))
        (updated-sessions (unwrap! (as-max-len? (append current-sessions session-id) u20) ERR_INVALID_INPUT))
      )
      (map-set child-sessions
        { child-id: child-id }
        { session-ids: updated-sessions }
      )
    )

    (ok true)
  )
)

(define-public (unenroll-child (session-id uint) (child-id uint))
  (let
    (
      (session (unwrap! (map-get? activity-sessions { session-id: session-id }) ERR_NOT_FOUND))
      (participant (unwrap! (map-get? session-participants { session-id: session-id, child-id: child-id }) ERR_NOT_FOUND))
      (current-participants (get current-participants session))
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-eq (get status session) "scheduled") ERR_INVALID_INPUT)
    (asserts! (get enrolled participant) ERR_INVALID_INPUT)

    ;; Update participant status
    (map-set session-participants
      { session-id: session-id, child-id: child-id }
      (merge participant { enrolled: false, attendance-status: "unenrolled" })
    )

    ;; Update session participant count
    (map-set activity-sessions
      { session-id: session-id }
      (merge session { current-participants: (- current-participants u1) })
    )

    (ok true)
  )
)

(define-public (mark-attendance (session-id uint) (child-id uint) (attendance-status (string-ascii 20)))
  (let
    (
      (participant (unwrap! (map-get? session-participants { session-id: session-id, child-id: child-id }) ERR_NOT_FOUND))
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-authorized-planner) ERR_UNAUTHORIZED)
    (asserts! (get enrolled participant) ERR_INVALID_INPUT)

    ;; Update attendance status
    (map-set session-participants
      { session-id: session-id, child-id: child-id }
      (merge participant { attendance-status: attendance-status })
    )

    (ok true)
  )
)

(define-public (rate-participation (session-id uint) (child-id uint) (rating uint) (feedback-hash (buff 32)))
  (let
    (
      (participant (unwrap! (map-get? session-participants { session-id: session-id, child-id: child-id }) ERR_NOT_FOUND))
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (<= rating u5) ERR_INVALID_INPUT)
    (asserts! (>= rating u1) ERR_INVALID_INPUT)

    ;; Update participation rating and feedback
    (map-set session-participants
      { session-id: session-id, child-id: child-id }
      (merge participant {
        participation-rating: (some rating),
        parent-feedback-hash: (some feedback-hash)
      })
    )

    (ok true)
  )
)

;; Resource Management Functions
(define-public (add-resource
  (name-hash (buff 32))
  (description-hash (buff 32))
  (resource-type (string-ascii 30))
  (quantity-available uint)
  (location-hash (buff 32)))
  (let
    (
      (resource-id (var-get next-resource-id))
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-authorized-planner) ERR_UNAUTHORIZED)
    (asserts! (> quantity-available u0) ERR_INVALID_INPUT)

    ;; Create resource record
    (map-set activity-resources
      { resource-id: resource-id }
      {
        name-hash: name-hash,
        description-hash: description-hash,
        resource-type: resource-type,
        quantity-available: quantity-available,
        quantity-reserved: u0,
        location-hash: location-hash,
        maintenance-date: none,
        status: "available"
      }
    )

    ;; Increment resource ID
    (var-set next-resource-id (+ resource-id u1))

    (ok resource-id)
  )
)

(define-public (reserve-resource (session-id uint) (resource-id uint) (quantity uint))
  (let
    (
      (resource (unwrap! (map-get? activity-resources { resource-id: resource-id }) ERR_NOT_FOUND))
      (available-quantity (- (get quantity-available resource) (get quantity-reserved resource)))
      (current-block block-height)
    )
    (asserts! (is-contract-active) ERR_UNAUTHORIZED)
    (asserts! (is-authorized-planner) ERR_UNAUTHORIZED)
    (asserts! (>= available-quantity quantity) ERR_CAPACITY_FULL)
    (asserts! (is-eq (get status resource) "available") ERR_INVALID_INPUT)

    ;; Create reservation
    (map-set resource-reservations
      { session-id: session-id, resource-id: resource-id }
      {
        quantity-reserved: quantity,
        reservation-date: current-block,
        status: "reserved"
      }
    )

    ;; Update resource reserved quantity
    (map-set activity-resources
      { resource-id: resource-id }
      (merge resource { quantity-reserved: (+ (get quantity-reserved resource) quantity) })
    )

    (ok true)
  )
)

;; Read-only Functions
(define-read-only (get-activity (activity-id uint))
  (map-get? activities { activity-id: activity-id })
)

(define-read-only (get-session (session-id uint))
  (map-get? activity-sessions { session-id: session-id })
)

(define-read-only (get-session-participant (session-id uint) (child-id uint))
  (map-get? session-participants { session-id: session-id, child-id: child-id })
)

(define-read-only (get-child-sessions (child-id uint))
  (map-get? child-sessions { child-id: child-id })
)

(define-read-only (get-resource (resource-id uint))
  (map-get? activity-resources { resource-id: resource-id })
)

(define-read-only (get-resource-reservation (session-id uint) (resource-id uint))
  (map-get? resource-reservations { session-id: session-id, resource-id: resource-id })
)

(define-read-only (is-session-full (session-id uint))
  (match (map-get? activity-sessions { session-id: session-id })
    session (>= (get current-participants session) (get max-participants session))
    false
  )
)

(define-read-only (get-available-capacity (session-id uint))
  (match (map-get? activity-sessions { session-id: session-id })
    session (- (get max-participants session) (get current-participants session))
    u0
  )
)

(define-read-only (get-contract-info)
  {
    paused: (var-get contract-paused),
    next-activity-id: (var-get next-activity-id),
    next-session-id: (var-get next-session-id),
    next-resource-id: (var-get next-resource-id)
  }
)
