"""WJEC Unit 4 LAMP seed content — a booking-system project."""

from __future__ import annotations

from .models import (
    Concept,
    Decision,
    DecisionStatus,
    DecisionType,
    Depth,
    Evidence,
    EvidenceKind,
    LearnerState,
    PedagogyMode,
    Project,
    RelationKind,
    Relationship,
    Seed,
    Skill,
    Stack,
    Task,
    Tool,
    UIComponent,
)


def _c(**kw) -> Concept:
    return Concept(**kw)


CONCEPTS = [
    _c(
        id="box-model",
        title="The CSS box model",
        stack=Stack.CSS,
        depth=Depth.FOUNDATION,
        summary="Every element is a content box wrapped in padding, border and margin. Layout bugs are usually box-model bugs.",
        vocabulary=["content", "padding", "border", "margin", "box-sizing"],
        common_errors=[
            "Adding width and padding without border-box and overflowing the row",
            "Collapsing margins mistaken for missing margin",
        ],
        code_example=".card { box-sizing: border-box; padding: 1rem; border: 1px solid #ddd; }",
        wjec_reference="U4.2 Interface design",
        relationships=[Relationship(kind=RelationKind.REQUIRES, target="html-structure")],
    ),
    _c(
        id="html-structure",
        title="Semantic HTML structure",
        stack=Stack.HTML,
        depth=Depth.FOUNDATION,
        summary="Document structure carries meaning: headings, landmarks, labels and form controls.",
        vocabulary=["element", "attribute", "landmark", "label", "form"],
        common_errors=["Using div for everything", "Inputs without associated labels"],
        code_example='<label for="email">Email</label><input id="email" type="email">',
        wjec_reference="U4.2 Interface design",
    ),
    _c(
        id="bootstrap-grid",
        title="Bootstrap grid and utilities",
        stack=Stack.BOOTSTRAP,
        depth=Depth.FOUNDATION,
        summary="A 12-column responsive grid plus utility classes. Composition replaces bespoke CSS for most layouts.",
        vocabulary=["container", "row", "col", "breakpoint", "utility"],
        common_errors=["Columns not wrapped in a row", "Fighting utilities with custom CSS"],
        code_example='<div class="container"><div class="row"><div class="col-md-6">…</div></div></div>',
        wjec_reference="U4.2 Interface design",
        relationships=[Relationship(kind=RelationKind.REQUIRES, target="box-model")],
    ),
    _c(
        id="forms-validation",
        title="Form validation",
        stack=Stack.PHP,
        depth=Depth.INTERMEDIATE,
        summary="Client-side validation is UX. Server-side validation is correctness and security. You need both.",
        vocabulary=["required", "sanitise", "filter_var", "error state"],
        common_errors=["Trusting client-side validation", "Echoing raw user input back"],
        code_example="if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $errors[] = 'Invalid email'; }",
        wjec_reference="U4.4 Development",
        relationships=[
            Relationship(kind=RelationKind.REQUIRES, target="html-structure"),
            Relationship(kind=RelationKind.USES, target="php-request"),
        ],
    ),
    _c(
        id="php-request",
        title="The PHP request lifecycle",
        stack=Stack.PHP,
        depth=Depth.INTERMEDIATE,
        summary="A request arrives, PHP runs top to bottom, produces a response, and forgets everything unless you persist it.",
        vocabulary=["$_POST", "$_GET", "superglobal", "header", "session"],
        common_errors=["Expecting state between requests", "Output before header()"],
        code_example="$name = $_POST['name'] ?? '';",
        wjec_reference="U4.4 Development",
    ),
    _c(
        id="crud",
        title="CRUD operations",
        stack=Stack.MYSQL,
        depth=Depth.INTERMEDIATE,
        summary="Create, read, update, delete — the four operations every transactional site is built from.",
        vocabulary=["INSERT", "SELECT", "UPDATE", "DELETE"],
        common_errors=["UPDATE or DELETE without WHERE", "Reading before checking the insert succeeded"],
        code_example="INSERT INTO bookings (customer_id, slot_id) VALUES (?, ?);",
        wjec_reference="U4.3 Data design",
        relationships=[
            Relationship(kind=RelationKind.REQUIRES, target="relational-model"),
            Relationship(kind=RelationKind.USES, target="prepared-statements"),
            Relationship(kind=RelationKind.EVIDENCED_BY, target="ADR-014"),
        ],
    ),
    _c(
        id="relational-model",
        title="Relational modelling",
        stack=Stack.MYSQL,
        depth=Depth.INTERMEDIATE,
        summary="Entities become tables, relationships become keys. The ERD is the contract for everything above it.",
        vocabulary=["entity", "primary key", "foreign key", "cardinality", "ERD"],
        common_errors=["Repeating groups in one table", "No foreign key constraints"],
        code_example="CREATE TABLE bookings (id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL);",
        wjec_reference="U4.3 Data design",
    ),
    _c(
        id="normalisation",
        title="Normalisation to 3NF",
        stack=Stack.MYSQL,
        depth=Depth.ADVANCED,
        summary="Remove repeating groups, partial dependencies and transitive dependencies so a fact lives in exactly one place.",
        vocabulary=["1NF", "2NF", "3NF", "functional dependency", "anomaly"],
        common_errors=["Storing customer name on the booking row", "Normalising past the point of usefulness"],
        wjec_reference="U4.3 Data design",
        relationships=[Relationship(kind=RelationKind.REQUIRES, target="relational-model")],
    ),
    _c(
        id="prepared-statements",
        title="Prepared statements",
        stack=Stack.PHP,
        depth=Depth.INTERMEDIATE,
        summary="Parameterised queries separate code from data, which is what actually stops SQL injection.",
        vocabulary=["PDO", "bind", "placeholder", "injection"],
        common_errors=["String-concatenating user input into SQL", "Escaping instead of binding"],
        code_example="$stmt = $pdo->prepare('SELECT * FROM bookings WHERE id = ?'); $stmt->execute([$id]);",
        wjec_reference="U4.4 Development",
    ),
    _c(
        id="sessions-auth",
        title="Sessions and authentication",
        stack=Stack.PHP,
        depth=Depth.ADVANCED,
        summary="A session is a server-side record keyed by a cookie. Authentication decides who you are; authorisation decides what you may do.",
        vocabulary=["session_start", "password_hash", "authorisation", "cookie"],
        common_errors=["Storing plaintext passwords", "Checking auth in the UI only"],
        code_example="if (password_verify($input, $row['password_hash'])) { $_SESSION['user_id'] = $row['id']; }",
        wjec_reference="U4.4 Development",
        relationships=[Relationship(kind=RelationKind.REQUIRES, target="php-request")],
    ),
    _c(
        id="testing-evidence",
        title="Test evidence",
        stack=Stack.ARCHITECTURE,
        depth=Depth.INTERMEDIATE,
        summary="A test is a claim plus the observation that supports it. Evidence is what turns a claim into a mark.",
        vocabulary=["test case", "expected", "actual", "boundary", "erroneous"],
        common_errors=["Only testing the happy path", "Screenshots with no expected value stated"],
        wjec_reference="U4.5 Testing",
    ),
    _c(
        id="adr",
        title="Architectural Decision Records",
        stack=Stack.ARCHITECTURE,
        depth=Depth.ADVANCED,
        summary="Context, decision, alternatives, rationale, consequences. Written when the decision is made, not reconstructed at the end.",
        vocabulary=["context", "rationale", "consequence", "supersede"],
        common_errors=["Describing what was built instead of why", "Writing all ADRs the night before"],
        wjec_reference="U4.1 Design decisions",
    ),
]

SKILLS = [
    Skill(
        id="skill-compose-layout",
        title="Compose a responsive layout with Bootstrap",
        concept_ids=["bootstrap-grid", "box-model"],
        observable_behaviour="Builds a two-column form layout that reflows at the md breakpoint without custom CSS.",
    ),
    Skill(
        id="skill-safe-write",
        title="Write to the database safely",
        concept_ids=["crud", "prepared-statements"],
        observable_behaviour="Inserts a booking using a prepared statement and handles the failure branch.",
    ),
    Skill(
        id="skill-justify",
        title="Justify a design decision",
        concept_ids=["adr", "normalisation"],
        observable_behaviour="States alternatives considered and the consequence accepted, not just the choice made.",
    ),
]

TASKS = [
    Task(
        id="task-001",
        title="Build the booking form markup",
        prompt="Create an accessible booking form with name, email, date and slot.",
        concept_ids=["html-structure", "bootstrap-grid"],
        difficulty=2,
        mode=PedagogyMode.WE_DO,
        success_criteria=["Every input has a label", "Layout uses the grid, not custom floats"],
    ),
    Task(
        id="task-002",
        title="Validate the booking server-side",
        prompt="Reject invalid emails and double bookings before touching the database.",
        concept_ids=["forms-validation", "php-request"],
        difficulty=3,
        mode=PedagogyMode.WE_DO,
        success_criteria=["Server rejects invalid email", "Errors returned to the form, input preserved"],
    ),
    Task(
        id="task-003",
        title="Normalise the booking schema",
        prompt="Take the flat bookings sheet to 3NF and draw the ERD.",
        concept_ids=["normalisation", "relational-model"],
        difficulty=4,
        mode=PedagogyMode.YOU_DO,
        success_criteria=["No repeating groups", "Every non-key attribute depends on the key alone"],
    ),
]

DECISIONS = [
    Decision(
        id="ADR-014",
        title="Use prepared statements for every database write",
        status=DecisionStatus.ACCEPTED,
        type=DecisionType.SECURITY,
        depth=Depth.INTERMEDIATE,
        project_id="booking-system",
        context="The booking form writes user-supplied values straight into MySQL. Early prototypes concatenated the values into the SQL string.",
        decision="All reads and writes go through PDO prepared statements with bound parameters.",
        alternatives=[
            "Escape input with mysqli_real_escape_string",
            "Validate input strictly and keep string concatenation",
        ],
        rationale="Escaping depends on remembering to escape every value in every place. Binding separates code from data structurally, so the failure mode is a broken query rather than an injection.",
        consequences=[
            "Every query needs a prepare/execute pair, which is more verbose",
            "Dynamic column names still need an allow-list, since they cannot be bound",
        ],
        evidence_ids=["EV-021", "EV-022"],
        concept_ids=["prepared-statements", "crud"],
        word_count_target=250,
    ),
    Decision(
        id="ADR-018",
        title="Relational database architecture for the booking system",
        status=DecisionStatus.ACCEPTED,
        type=DecisionType.DATA_ARCHITECTURE,
        depth=Depth.INTERMEDIATE,
        project_id="booking-system",
        context="Bookings, customers and slots were originally one wide table, which duplicated customer details on every booking.",
        decision="Split into customers, slots and bookings, with bookings holding foreign keys to both.",
        alternatives=[
            "Keep one denormalised bookings table for simpler queries",
            "Separate customers only, leaving slot text on the booking",
        ],
        rationale="Duplicated customer details caused update anomalies during testing: changing an email updated only one row. Third normal form removes the anomaly and makes the ERD legible to the examiner.",
        consequences=[
            "Reads now need joins",
            "Referential integrity is enforced by the database rather than by application code",
        ],
        evidence_ids=["EV-030"],
        concept_ids=["relational-model", "normalisation", "crud"],
        word_count_target=350,
    ),
    Decision(
        id="ADR-021",
        title="Adopt Bootstrap rather than bespoke CSS",
        status=DecisionStatus.ACCEPTED,
        type=DecisionType.INTERFACE_DESIGN,
        depth=Depth.FOUNDATION,
        project_id="booking-system",
        context="The interface needs to be responsive and consistent, but the time budget is dominated by the database and PHP work.",
        decision="Use Bootstrap 5 utilities and grid for layout; write custom CSS only for brand colour and spacing overrides.",
        alternatives=["Hand-written CSS with flexbox", "A CSS reset plus custom grid"],
        rationale="The assessment rewards a working, consistent interface, not novel CSS. Bootstrap makes the box model explicit through named classes, which also gives the learner vocabulary to explain the layout.",
        consequences=[
            "Markup carries more classes",
            "Any bespoke visual identity has to override defaults deliberately",
        ],
        evidence_ids=["EV-011"],
        concept_ids=["bootstrap-grid", "box-model"],
        word_count_target=200,
    ),
    Decision(
        id="ADR-025",
        title="Server-side validation is authoritative",
        status=DecisionStatus.ACCEPTED,
        type=DecisionType.ALGORITHM,
        depth=Depth.INTERMEDIATE,
        project_id="booking-system",
        context="HTML5 validation already blocks empty and malformed fields in the browser.",
        decision="Treat client-side validation as a hint and revalidate everything in PHP before persisting.",
        alternatives=["Rely on HTML5 constraints", "Validate with JavaScript before submit"],
        rationale="Client-side checks can be bypassed with a crafted request, so they cannot be the guarantee. Revalidating server-side keeps the database the single point of truth for what a valid booking is.",
        consequences=["Validation rules exist in two places and must stay in step"],
        evidence_ids=["EV-040"],
        concept_ids=["forms-validation", "php-request"],
        word_count_target=250,
    ),
    Decision(
        id="ADR-029",
        title="Hash passwords with password_hash rather than a custom scheme",
        status=DecisionStatus.ACCEPTED,
        type=DecisionType.SECURITY,
        depth=Depth.ADVANCED,
        project_id="booking-system",
        context="Staff accounts need a login to manage slots.",
        decision="Store only password_hash output and verify with password_verify.",
        alternatives=["Salted SHA-256 written by hand", "Plaintext with restricted database access"],
        rationale="A hand-rolled scheme has to get salting, iteration count and comparison timing right. password_hash is the language's maintained default and upgrades algorithm over time.",
        consequences=["Hashes are opaque and cannot be compared directly in SQL"],
        evidence_ids=["EV-051"],
        concept_ids=["sessions-auth"],
        word_count_target=250,
    ),
    Decision(
        id="ADR-033",
        title="Test boundary and erroneous cases, not just valid ones",
        status=DecisionStatus.ACCEPTED,
        type=DecisionType.TESTING,
        depth=Depth.INTERMEDIATE,
        project_id="booking-system",
        context="Initial testing only showed the booking succeeding.",
        decision="Every feature gets a normal, boundary and erroneous test case recorded with expected and actual results.",
        alternatives=["Screenshot the working feature", "Test only what changed"],
        rationale="Evidence of failure handling is what distinguishes a described system from a tested one, and the boundary cases are where the date and slot logic actually breaks.",
        consequences=["The test table grows substantially and needs maintaining as features change"],
        evidence_ids=["EV-060"],
        concept_ids=["testing-evidence"],
        word_count_target=200,
    ),
]

EVIDENCE = [
    Evidence(
        id="EV-011",
        kind=EvidenceKind.ARTEFACT,
        concept_ids=["bootstrap-grid"],
        decision_id="ADR-021",
        body="booking-form.html renders a two-column layout that stacks below the md breakpoint.",
    ),
    Evidence(
        id="EV-021",
        kind=EvidenceKind.CODE,
        concept_ids=["prepared-statements"],
        decision_id="ADR-014",
        body="create_booking.php uses $pdo->prepare with two bound parameters.",
    ),
    Evidence(
        id="EV-022",
        kind=EvidenceKind.TEST,
        concept_ids=["prepared-statements"],
        decision_id="ADR-014",
        body="Test-024: submitting \"' OR 1=1 --\" as the name stores the literal string and returns one row.",
    ),
    Evidence(
        id="EV-030",
        kind=EvidenceKind.SCHEMA,
        concept_ids=["relational-model", "normalisation"],
        decision_id="ADR-018",
        body="schema.sql defines customers, slots and bookings with two foreign keys.",
    ),
    Evidence(
        id="EV-040",
        kind=EvidenceKind.TEST,
        concept_ids=["forms-validation"],
        decision_id="ADR-025",
        body="Test-031: a POST sent with curl bypassing the browser is rejected with 'Invalid email'.",
    ),
    Evidence(
        id="EV-051",
        kind=EvidenceKind.CODE,
        concept_ids=["sessions-auth"],
        decision_id="ADR-029",
        body="login.php calls password_verify and regenerates the session id on success.",
    ),
    Evidence(
        id="EV-060",
        kind=EvidenceKind.EXPLANATION,
        concept_ids=["testing-evidence"],
        decision_id="ADR-033",
        body="Test table records normal, boundary and erroneous cases for each of the six features.",
    ),
]

COMPONENTS = [
    UIComponent(
        id="ui-booking-form",
        label="Booking form",
        bootstrap_classes=["container", "row", "col-md-6", "form-label", "form-control", "btn", "btn-primary"],
        html=(
            '<div class="container py-4">\n'
            '  <h2 class="h4 mb-3">Book a slot</h2>\n'
            '  <form class="row g-3" novalidate>\n'
            '    <div class="col-md-6">\n'
            '      <label for="name" class="form-label">Full name</label>\n'
            '      <input id="name" name="name" class="form-control" required>\n'
            "    </div>\n"
            '    <div class="col-md-6">\n'
            '      <label for="email" class="form-label">Email</label>\n'
            '      <input id="email" name="email" type="email" class="form-control" required>\n'
            "    </div>\n"
            '    <div class="col-md-6">\n'
            '      <label for="date" class="form-label">Date</label>\n'
            '      <input id="date" name="date" type="date" class="form-control" required>\n'
            "    </div>\n"
            '    <div class="col-md-6">\n'
            '      <label for="slot" class="form-label">Slot</label>\n'
            '      <select id="slot" name="slot" class="form-select">\n'
            "        <option>09:00</option><option>11:00</option><option>14:00</option>\n"
            "      </select>\n"
            "    </div>\n"
            '    <div class="col-12">\n'
            '      <button class="btn btn-primary" type="submit">Request booking</button>\n'
            "    </div>\n"
            "  </form>\n"
            "</div>"
        ),
        concept_ids=["html-structure", "bootstrap-grid", "forms-validation"],
        notes="Every control is labelled; the grid handles the reflow rather than custom CSS.",
    ),
    UIComponent(
        id="ui-booking-table",
        label="Bookings table",
        bootstrap_classes=["table", "table-striped", "table-responsive", "badge"],
        html=(
            '<div class="container py-4">\n'
            '  <div class="table-responsive">\n'
            '    <table class="table table-striped align-middle">\n'
            "      <thead><tr><th>Ref</th><th>Customer</th><th>Slot</th><th>Status</th></tr></thead>\n"
            "      <tbody>\n"
            '        <tr><td>B-1041</td><td>A. Rees</td><td>2026-09-04 09:00</td><td><span class="badge text-bg-success">Confirmed</span></td></tr>\n'
            '        <tr><td>B-1042</td><td>J. Owen</td><td>2026-09-04 11:00</td><td><span class="badge text-bg-warning">Pending</span></td></tr>\n'
            "      </tbody>\n"
            "    </table>\n"
            "  </div>\n"
            "</div>"
        ),
        concept_ids=["crud", "relational-model"],
        notes="Reads join customers and slots; the status badge is a derived value, not a stored one.",
    ),
    UIComponent(
        id="ui-validation-errors",
        label="Validation error state",
        bootstrap_classes=["alert", "alert-danger", "is-invalid", "invalid-feedback"],
        html=(
            '<div class="container py-4">\n'
            '  <div class="alert alert-danger" role="alert">Your booking could not be saved.</div>\n'
            '  <label for="email2" class="form-label">Email</label>\n'
            '  <input id="email2" class="form-control is-invalid" value="a.rees@@example">\n'
            '  <div class="invalid-feedback">Invalid email format.</div>\n'
            "</div>"
        ),
        concept_ids=["forms-validation"],
        notes="The error is announced at the top and attached to the field, and the input keeps the value.",
    ),
]

PROJECTS = [
    Project(
        id="booking-system",
        title="Community centre booking system",
        brief="A transactional website where members request slots and staff confirm them.",
        concept_ids=[c.id for c in CONCEPTS],
        decision_ids=[d.id for d in DECISIONS],
        files=["index.php", "booking-form.php", "create_booking.php", "login.php", "schema.sql", "styles.css"],
    )
]

LEARNER = LearnerState(
    learner_id="demo-learner",
    mode=PedagogyMode.WE_DO,
    accuracy=0.72,
    median_response_ms=8400,
    retries=3,
    hint_requests=2,
    idle_seconds=14,
    successful_retrievals=11,
    failed_retrievals=4,
    seconds_since_last_exposure=172800,
    task_difficulty=3,
    mastered_concept_ids=["html-structure", "box-model", "php-request"],
    emerging_concept_ids=["normalisation", "prepared-statements", "adr"],
)

TOOLS = [
    Tool(
        name="list_concepts",
        title="List concepts",
        description="List the LAMP concepts in the curriculum graph, optionally filtered by stack or depth.",
        read_only=True,
        input_schema_ref="ListConceptsInput",
    ),
    Tool(
        name="get_adr",
        title="Get an ADR",
        description="Fetch a full Architectural Decision Record with its evidence and concept links.",
        read_only=True,
        input_schema_ref="GetAdrInput",
    ),
    Tool(
        name="create_experience",
        title="Create an experience",
        description="Turn an intent into a structured experience: narration, a renderable Bootstrap component, PHP and SQL.",
        read_only=False,
        input_schema_ref="ExperienceRequest",
    ),
    Tool(
        name="explain",
        title="Explain a concept",
        description="Explain a concept at the learner's current pedagogy mode, with vocabulary and common errors.",
        read_only=True,
        input_schema_ref="ExplainInput",
    ),
    Tool(
        name="assess_evidence",
        title="Assess evidence",
        description="Score a piece of learner evidence against the concepts it claims to demonstrate.",
        read_only=False,
        input_schema_ref="AssessEvidenceInput",
    ),
    Tool(
        name="get_learner_state",
        title="Get learner state",
        description="Return the current learner model: mode, mastery, retrieval history and interaction signals.",
        read_only=True,
        input_schema_ref="GetLearnerStateInput",
    ),
]


def build_seed() -> Seed:
    return Seed(
        concepts=CONCEPTS,
        skills=SKILLS,
        tasks=TASKS,
        decisions=DECISIONS,
        evidence=EVIDENCE,
        components=COMPONENTS,
        projects=PROJECTS,
        learner=LEARNER,
        tools=TOOLS,
    )
