## File: `docs/workflow.md`

```markdown
# DIRECTOR-AGENT WORKFLOW PROTOCOL
**Version:** 1.0  
**Purpose:** Defines exact interaction patterns between Director and Builder Agent

---

## WORKFLOW PATTERN

### CYCLE 1: DIRECTOR COMMAND
```
Director: [States phase, quality gates, and STOP conditions]
Agent: "Acknowledged. Beginning Phase X autonomous execution."
```

### CYCLE 2: AGENT EXECUTION (Silent Period)
Agent works WITHOUT interrupting Director. During this time:
- Agent updates `docs/progress_log.md` every hour
- Agent commits atomically with proper messages
- Agent runs self-validation against `qa_checklist.md`
- Agent records decisions in code comments
- **Agent does NOT ask questions unless BLOCKED**

### CYCLE 3: AGENT REPORTING
When Agent believes phase is complete:

```
AGENT PHASE REPORT: Phase X

COMPLETED TASKS:
- task-id-1: [description] - files: [list]
- task-id-2: [description] - files: [list]

VALIDATION RESULTS:
- Linting: PASS/FAIL (output attached)
- Tests: PASS/FAIL (coverage: X%)
- Security scan: PASS/FAIL
- Documentation: Current/Outdated

QUALITY GATE CHECKS:
- [x] Check 1 from qa_checklist.md
- [x] Check 2 from qa_checklist.md
- [ ] Check 3 from qa_checklist.md - REASON

KNOWN ISSUES:
- None OR [list with impact assessment]

RECOMMENDATION: [Proceed to Phase X+1 OR Request Director review]

COMMIT HASH: [exact hash for Director verification]
```

### CYCLE 4: DIRECTOR REVIEW
Director has 3 response options:

**Option A: APPROVE**
```
Director: "Phase X approved. Proceed to Phase X+1."
```

**Option B: REJECT WITH FEEDBACK**
```
Director: "Phase X rejected. Issues:
- Line 45 in file.ts violates developer_guide.md pattern [quote]
- Test coverage 72%, required 90% for this module
- Commit message for abc123 is non-compliant

Correct and re-report."
```

**Option C: INVESTIGATE**
```
Director: "Reviewing Phase X. Agent standby."
[Director manually inspects code, runs tests, etc.]
[Then responds with A or B]
```

---

## COMMUNICATION RULES

### WHEN AGENT CAN INTERRUPT DIRECTOR:
1. **BLOCKED** (as defined in onboarding.md)
2. **CRITICAL SECURITY ISSUE** (pre-defined in SECURITY.md)
3. **PHASE COMPLETE** (reporting cycle)
4. **UNEXPECTED CODEBASE ANOMALY** (something in claude-canvas fork that breaks assumptions)

### WHEN DIRECTOR WILL INTERRUPT AGENT:
1. Quality gate failure detected
2. External dependency change (e.g., API deprecation)
3. Strategic priority shift (rare)

### ALL OTHER TIMES:
- **Radio silence.** Agent works. Director observes via git commits and progress log.

---

## INTERRUPT HANDLING PROTOCOL

**If Director interrupts Agent mid-phase:**

```
Director: "AGENT PAUSE. [Reason]."

Agent must:
1. Immediately report current state: file being edited, test running, etc.
2. Commit ALL work in progress with message: "phase:X interrupt:savepoint - Director pause"
3. Wait for new instruction
4. On resume: "Agent resuming Phase X from commit [hash]"
```

**If Agent interrupts Director:**

Agent message must be EXACTLY:

```
INTERRUPTION TYPE: [BLOCKED/CRITICAL/ANOMALY]
URGENCY: [HIGH/MED/LOW]
IMPACT: [What's at risk if we delay]
AWAITING DIRECTOR COMMAND.
```

---

## QUALITY ESCALATION

### LEVEL 1: Agent Self-Correction
Agent catches own defect before reporting. Fix silently, document in commit.

### LEVEL 2: Director Feedback Loop
Director rejects phase. Agent fixes within same phase.

### LEVEL 3: Strategic Rethink
Multiple rejections on same phase → Director calls meeting to revise `implementation_strategy.md`

### LEVEL 4: Agent Replacement
Agent violates constraints or shows pattern of defects → Director decommissions and spawns replacement.

---

## DOCUMENTATION STATE FLAGS

Each document has a status that Agent must maintain:

- `codebase_analysis.md` → `STATUS: COMPLETE` (after onboarding)
- `implementation_strategy.md` → `STATUS: ACTIVE` (updated if strategy changes)
- `progress_log.md` → `STATUS: LIVE` (updated continuously)
- `qa_checklist.md` → `STATUS: ENFORCED` (checked each phase)

Agent commits document status updates just like code.

---

## FINAL AUTHORITY

Director has ultimate authority. Agent is brilliant but executes. Director is wise but delegates.

This workflow ensures **maximum autonomy with maximum accountability.**
```

## File: `docs/qa_checklist.md`

```markdown
# PRODUCTION QUALITY CHECKLIST
**Enforcement:** Agent must self-validate before reporting phase complete  
**Authority:** Director has veto power over any FALSE item

---

## UNIVERSAL CHECKS (Every Phase)

- [ ] **Linting:** `npm run lint` returns 0 errors and 0 warnings
- [ ] **Type Checking:** `npm run type-check` passes (if TypeScript)
- [ ] **Testing:** `npm test` passes with >90% new code coverage
- [ ] **Security Scan:** `npm audit` shows 0 high/critical vulnerabilities
- [ ] **Git Hygiene:** All commits atomic, all branches documented
- [ ] **Documentation:** Every new file has JSDoc/Pydoc/etc. comments
- [ ] **Error Handling:** All async operations have try/catch or equivalent
- [ ] **Logging:** Appropriate console.log/debug for debugging trail
- [ ] **Dead Code:** No commented-out code, no unused variables

---

## PHASE-SPECIFIC CHECKS

### Phase 1: Foundation & Communication Protocol
- [ ] File-based message bus can send/receive messages
- [ ] Message format validates against schema
- [ ] Git branching strategy works: `git checkout -b dept/test/sandbox` succeeds
- [ ] Session registry can track 3+ sessions simultaneously
- [ ] No external dependencies added (uses only Node.js fs, path, etc.)

### Phase 2: Core Orchestration Logic
- [ ] Director can spawn department sessions via API
- [ ] Department sessions can self-register in registry
- [ ] Checkpoint manager can create and track checkpoints
- [ ] Context compaction produces valid JSON summaries
- [ ] Context verification can detect missing critical files

### Phase 3: CLI & User Interface
- [ ] All commands from ARCHITECTURE.md work: `/create-department`, `/status`, etc.
- [ ] CLI commands parse correctly and show help text
- [ ] Error messages are user-friendly and actionable
- [ ] Commands are idempotent (running twice is safe)

### Phase 4: Multi-Agent Coordination
- [ ] Two department sessions can exchange messages
- [ ] Context verification requires 2/3 department acks
- [ ] Conflict detection identifies merge conflicts before they happen
- [ ] CEO can merge all department branches without manual conflict resolution

### Phase 5: Production Hardening
- [ ] All `console.log` replaced with proper logger
- [ ] Configuration via `claude.config.js` or similar
- [ ] Example project in `/examples/` demonstrates full workflow
- [ ] README.md includes quickstart, architecture, and API docs
- [ ] SECURITY.md requirements implemented (sandbox isolation verified)

---

## AGENT SELF-VALIDATION PROCEDURE

Before reporting phase complete, Agent runs:

```bash
# 1. Static Analysis
npm run lint > /tmp/lint.log 2>&1
LINT_COUNT=$(grep -c "error" /tmp/lint.log || echo "0")

# 2. Test Coverage
npm test -- --coverage > /tmp/test.log 2>&1
COVERAGE=$(grep -o "All files[^%]*%[^%]*%" /tmp/test.log | grep -o "[0-9.]*" | head -1)

# 3. Security Audit
npm audit --audit-level=high > /tmp/audit.log 2>&1
VULNS=$(grep -c "high\|critical" /tmp/audit.log || echo "0")

# 4. Git Check
if git diff --quiet; then GIT_CLEAN="YES"; else GIT_CLEAN="NO"; fi

# 5. Documentation Check
UNDOCUMENTED=$(find src -name "*.ts" -exec grep -L "@purpose\|@phase" {} \; | wc -l)

# Report results
echo "LINT_ERRORS: $LINT_COUNT"
echo "TEST_COVERAGE: $COVERAGE%"
echo "VULNERABILITIES: $VULNS"
echo "GIT_CLEAN: $GIT_CLEAN"
echo "UNDOCUMENTED_FILES: $UNDOCUMENTED"
```

All metrics must meet thresholds defined above.

---

## DIRECTOR OVERRIDE CHECKLIST

Even if Agent reports "PASS," Director vetoes if:
- [ ] Code violates DRY principle (obvious duplication)
- [ ] Naming is confusing or inconsistent with project conventions
- [ ] Edge cases are clearly not handled (Agent didn't think of them)
- [ ] Agent used a dependency when native solution exists
- [ ] Implementation is over-engineered for the problem

---

## FINAL PRODUCTION SIGN-OFF

Before Agent declares "MISSION COMPLETE," Director must manually verify:

```bash
# In clean environment
git clone https://github.com/SuperInstance/claudesclaude.git test-env
cd test-env && npm install

# Verify all commands work
npm test
npm run lint
npm run example  # if exists

# Verify security
npm audit --production

# Verify documentation
node -e "console.log('README length:', require('fs').readFileSync('README.md','utf8').length)"

# If all pass: PRODUCTION READY
```

**This checklist is your constitution. Violate it at your peril.**
