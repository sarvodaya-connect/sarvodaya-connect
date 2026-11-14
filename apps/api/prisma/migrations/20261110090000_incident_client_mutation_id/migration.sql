-- A retry of "Report an incident" with the same client id returns the incident already opened.
ALTER TABLE "emergency_incidents" ADD COLUMN "client_mutation_id" UUID;

CREATE UNIQUE INDEX "emergency_incidents_created_by_id_client_mutation_id_key" ON "emergency_incidents"("created_by_id", "client_mutation_id");
