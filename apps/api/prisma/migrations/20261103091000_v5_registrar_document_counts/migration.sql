-- V5 D11 / D12: national counts of each Registrar document per financial year.
CREATE INDEX "society_documents_financial_year_start_document_type_societ_idx" ON "society_documents"("financial_year_start", "document_type", "society_id");
