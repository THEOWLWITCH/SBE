BEGIN;
-- Additive schema-only contract. Historical records, approvals and executed bytes are unchanged.
-- Static field vocabulary mirrors the frozen CommonJS/browser core. No V4 clauses are public.
CREATE OR REPLACE FUNCTION research_private.partnership_contract() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $contract$ SELECT $json$
{
  "versions": {
    "api": "1.1.0",
    "schema": 3,
    "agreement": "1.1.0"
  },
  "schemas": {
    "application": {
      "label": "בקשה לשותפות, למחקר או לגישה",
      "fields": [
        {
          "id": "title",
          "label": "כותרת",
          "type": "text",
          "required": true,
          "maxLength": 240
        },
        {
          "id": "applicationType",
          "label": "סוג הבקשה",
          "type": "enum",
          "choices": {
            "partnership": "שותפות",
            "study": "מחקר",
            "access": "גישה"
          },
          "required": true
        },
        {
          "id": "fullName",
          "label": "שם מלא",
          "type": "text",
          "required": true
        },
        {
          "id": "email",
          "label": "דוא״ל",
          "type": "email",
          "required": true
        },
        {
          "id": "applicantType",
          "label": "סוג הפונה",
          "type": "enum",
          "choices": {
            "individual": "אדם פרטי",
            "institution": "מוסד"
          }
        },
        {
          "id": "institution",
          "label": "מוסד",
          "type": "text",
          "required": true,
          "requiredUnless": {
            "field": "applicantType",
            "equals": "individual"
          }
        },
        {
          "id": "department",
          "label": "מחלקה",
          "type": "text"
        },
        {
          "id": "position",
          "label": "תפקיד",
          "type": "text"
        },
        {
          "id": "phone",
          "label": "טלפון",
          "type": "text"
        },
        {
          "id": "profileNotes",
          "label": "פרטים מקצועיים",
          "type": "text"
        },
        {
          "id": "researchInterests",
          "label": "תחומי מחקר",
          "type": "tags"
        },
        {
          "id": "background",
          "label": "רקע",
          "type": "text"
        },
        {
          "id": "objectives",
          "label": "מטרות",
          "type": "text",
          "required": true
        },
        {
          "id": "researchQuestions",
          "label": "שאלות מחקר",
          "type": "tags",
          "required": true
        },
        {
          "id": "method",
          "label": "שיטת המחקר",
          "type": "text",
          "required": true
        },
        {
          "id": "population",
          "label": "אוכלוסיית המחקר",
          "type": "text",
          "required": true
        },
        {
          "id": "requestedTools",
          "label": "כלים מבוקשים",
          "type": "tags",
          "required": true
        },
        {
          "id": "questionnaireVersionIds",
          "label": "גרסאות שאלונים",
          "type": "tags",
          "itemType": "id",
          "reference": "instrument"
        },
        {
          "id": "startDate",
          "label": "מועד התחלה",
          "type": "date",
          "required": true
        },
        {
          "id": "endDate",
          "label": "מועד סיום",
          "type": "date",
          "required": true
        },
        {
          "id": "ethicsStatus",
          "label": "מצב אישור אתי",
          "type": "enum",
          "choices": {
            "pending": "בתהליך",
            "approved": "אושר",
            "not_required": "לא נדרש לפי תיעוד"
          },
          "required": true
        },
        {
          "id": "ethicsDetails",
          "label": "פירוט אישורים",
          "type": "text",
          "required": true
        },
        {
          "id": "consentPlan",
          "label": "תוכנית הסכמה",
          "type": "text",
          "required": true
        },
        {
          "id": "requestedPermissions",
          "label": "הרשאות מבוקשות",
          "type": "tags",
          "choices": [
            "view_study",
            "edit_study",
            "manage_questionnaires",
            "view_aggregate_results",
            "view_pseudonymized_data",
            "view_identifiable_data",
            "view_document_content",
            "export_data",
            "manage_participants",
            "contact_participants",
            "manage_researchers",
            "manage_consent",
            "view_audit_log",
            "view_approved_findings",
            "download_approved_findings",
            "propose_analysis",
            "view_analysis_results",
            "comment_on_findings",
            "view_approved_pseudonymized_data",
            "export_approved_dataset",
            "view_study_progress",
            "view_approved_contributions"
          ],
          "category": "access",
          "required": true
        },
        {
          "id": "requestedSupport",
          "label": "סיוע מבוקש",
          "type": "text"
        },
        {
          "id": "supportingDocumentIds",
          "label": "מסמכים תומכים",
          "type": "tags",
          "itemType": "id",
          "reference": "document"
        }
      ]
    },
    "analysis_request": {
      "label": "בקשת ניתוח",
      "fields": [
        {
          "id": "title",
          "label": "כותרת",
          "type": "text",
          "required": true,
          "maxLength": 240
        },
        {
          "id": "questions",
          "label": "שאלות לניתוח",
          "type": "tags",
          "required": true
        },
        {
          "id": "variables",
          "label": "משתנים",
          "type": "tags",
          "required": true
        },
        {
          "id": "comparisons",
          "label": "השוואות",
          "type": "tags"
        },
        {
          "id": "groupingVariable",
          "label": "משתנה קבוצות מאושר להשוואה",
          "type": "text",
          "maxLength": 120
        },
        {
          "id": "timePoints",
          "label": "מועדים",
          "type": "tags"
        },
        {
          "id": "requestedOutputs",
          "label": "תוצרים מבוקשים",
          "type": "tags",
          "required": true
        },
        {
          "id": "operation",
          "label": "סוג ניתוח מוצע",
          "type": "enum",
          "choices": {
            "descriptive": "סיכום תיאורי",
            "frequency": "התפלגות שכיחויות",
            "comparison": "השוואת קבוצות",
            "trend": "השוואה בין מועדים"
          },
          "required": true
        },
        {
          "id": "sourceSnapshotId",
          "label": "תמונת מקור",
          "type": "id",
          "reference": "snapshot"
        },
        {
          "id": "rationale",
          "label": "מטרת הניתוח",
          "type": "text"
        },
        {
          "id": "supportingDocumentIds",
          "label": "מסמכים תומכים",
          "type": "tags",
          "itemType": "id",
          "reference": "document"
        }
      ]
    },
    "analysis_result": {
      "label": "תוצאת ניתוח",
      "fields": [
        {
          "id": "title",
          "label": "כותרת",
          "type": "text",
          "required": true,
          "maxLength": 240
        },
        {
          "id": "analysisRequestId",
          "label": "בקשת הניתוח",
          "type": "id",
          "reference": "analysis_request",
          "required": true
        },
        {
          "id": "sourceSnapshotId",
          "label": "תמונת מקור",
          "type": "id",
          "reference": "snapshot",
          "required": true
        },
        {
          "id": "operation",
          "label": "סוג הניתוח",
          "type": "enum",
          "choices": {
            "descriptive": "סיכום תיאורי",
            "frequency": "התפלגות שכיחויות",
            "comparison": "השוואת קבוצות",
            "trend": "השוואה בין מועדים"
          },
          "required": true
        },
        {
          "id": "analysisVersion",
          "label": "גרסת הניתוח",
          "type": "text",
          "required": true
        },
        {
          "id": "summary",
          "label": "סיכום",
          "type": "text",
          "required": true
        },
        {
          "id": "method",
          "label": "שיטת הניתוח",
          "type": "text",
          "required": true
        },
        {
          "id": "limitations",
          "label": "מגבלות",
          "type": "text"
        },
        {
          "id": "privacyReview",
          "label": "סקירת פרטיות",
          "type": "text",
          "required": true,
          "category": "privacy"
        },
        {
          "id": "consentReview",
          "label": "התאמה להסכמות",
          "type": "text",
          "required": true,
          "category": "privacy"
        },
        {
          "id": "consentProtocolVersionId",
          "label": "גרסת פרוטוקול הסכמה",
          "type": "id",
          "reference": "consent",
          "required": true
        },
        {
          "id": "resultDocumentIds",
          "label": "מסמכי תוצאה",
          "type": "tags",
          "itemType": "id",
          "reference": "document"
        }
      ]
    },
    "finding": {
      "label": "ממצא",
      "fields": [
        {
          "id": "title",
          "label": "כותרת",
          "type": "text",
          "required": true,
          "maxLength": 240
        },
        {
          "id": "summary",
          "label": "סיכום הממצא",
          "type": "text",
          "required": true
        },
        {
          "id": "evidence",
          "label": "ראיות ותימוכין",
          "type": "text",
          "required": true
        },
        {
          "id": "sourceSnapshotId",
          "label": "תמונת מקור",
          "type": "id",
          "reference": "snapshot",
          "required": true
        },
        {
          "id": "analysisResultId",
          "label": "תוצאת ניתוח",
          "type": "id",
          "reference": "analysis_result"
        },
        {
          "id": "method",
          "label": "שיטה",
          "type": "text",
          "required": true
        },
        {
          "id": "analysisVersion",
          "label": "גרסת ניתוח",
          "type": "text",
          "required": true
        },
        {
          "id": "toolVersion",
          "label": "גרסת כלי",
          "type": "text",
          "required": true
        },
        {
          "id": "questionnaireVersionIds",
          "label": "גרסאות שאלונים",
          "type": "tags",
          "itemType": "id",
          "reference": "instrument",
          "required": true
        },
        {
          "id": "consentProtocolVersionId",
          "label": "גרסת פרוטוקול הסכמה",
          "type": "id",
          "reference": "consent",
          "required": true
        },
        {
          "id": "limitations",
          "label": "מגבלות",
          "type": "text"
        },
        {
          "id": "privacyReview",
          "label": "סקירת פרטיות",
          "type": "text",
          "required": true,
          "category": "privacy"
        },
        {
          "id": "consentReview",
          "label": "התאמה להסכמות",
          "type": "text",
          "required": true,
          "category": "privacy"
        },
        {
          "id": "supportingDocumentIds",
          "label": "מסמכים תומכים",
          "type": "tags",
          "itemType": "id",
          "reference": "document"
        }
      ]
    },
    "contribution": {
      "label": "תרומה",
      "fields": [
        {
          "id": "title",
          "label": "כותרת",
          "type": "text",
          "required": true,
          "maxLength": 240
        },
        {
          "id": "category",
          "label": "סוג התרומה",
          "type": "enum",
          "choices": {
            "scientific": "תרומה מדעית",
            "methodological": "תרומה מתודולוגית",
            "questionnaires": "שאלונים",
            "educational_content": "תוכן חינוכי",
            "technology": "טכנולוגיה",
            "funding": "מימון",
            "professional_services": "שירותים מקצועיים",
            "other": "אחר"
          },
          "required": true
        },
        {
          "id": "description",
          "label": "תיאור התרומה",
          "type": "text",
          "required": true
        },
        {
          "id": "deliverables",
          "label": "תוצרים מוצעים",
          "type": "text"
        },
        {
          "id": "requestedRecognition",
          "label": "הכרה מבוקשת",
          "type": "text"
        },
        {
          "id": "requestedCompensation",
          "label": "תמורה מבוקשת",
          "type": "money",
          "category": "financial"
        },
        {
          "id": "currency",
          "label": "מטבע",
          "type": "enum",
          "choices": {
            "ILS": "שקל",
            "USD": "דולר ארה״ב",
            "EUR": "אירו",
            "GBP": "ליש״ט"
          }
        },
        {
          "id": "requestedUsage",
          "label": "שימוש מבוקש",
          "type": "text",
          "category": "access"
        },
        {
          "id": "requestedIP",
          "label": "תנאי קניין רוחני מבוקשים",
          "type": "text",
          "category": "IP"
        },
        {
          "id": "requestedOwnerObligations",
          "label": "בקשות מבעלת המערכת",
          "type": "text",
          "category": "obligations"
        },
        {
          "id": "partnerResponsibilities",
          "label": "אחריות מוצעת לחוקרת",
          "type": "text",
          "category": "obligations"
        },
        {
          "id": "dueDate",
          "label": "מועד מוצע",
          "type": "date",
          "category": "deadline"
        },
        {
          "id": "supportingDocumentIds",
          "label": "מסמכים תומכים",
          "type": "tags",
          "itemType": "id",
          "reference": "document"
        }
      ]
    },
    "agreement": {
      "label": "הסכם",
      "fields": [
        {
          "id": "title",
          "label": "כותרת",
          "type": "text",
          "required": true,
          "maxLength": 240,
          "section": "parties"
        },
        {
          "id": "ownerName",
          "label": "שם בעלת המערכת",
          "type": "text",
          "required": true,
          "section": "parties"
        },
        {
          "id": "ownerInstitution",
          "label": "מוסד בעלת המערכת",
          "type": "text",
          "section": "parties"
        },
        {
          "id": "ownerEmail",
          "label": "דוא״ל בעלת המערכת",
          "type": "email",
          "section": "parties",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "ownerAddress",
          "label": "כתובת בעלת המערכת",
          "type": "text",
          "section": "parties",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "ownerSignatory",
          "label": "מורשית חתימה מטעם בעלת המערכת",
          "type": "text",
          "section": "parties",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "ownerAuthority",
          "label": "סמכות החתימה מטעם בעלת המערכת",
          "type": "text",
          "section": "parties",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "partnerName",
          "label": "שם החוקרת",
          "type": "text",
          "required": true,
          "section": "parties"
        },
        {
          "id": "partnerInstitution",
          "label": "מוסד החוקרת",
          "type": "text",
          "section": "parties"
        },
        {
          "id": "partnerEmail",
          "label": "דוא״ל החוקרת",
          "type": "email",
          "section": "parties",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "partnerAddress",
          "label": "כתובת החוקרת",
          "type": "text",
          "section": "parties",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "partnerSignatory",
          "label": "מורשית חתימה מטעם החוקרת",
          "type": "text",
          "section": "parties",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "partnerAuthority",
          "label": "סמכות החתימה מטעם החוקרת",
          "type": "text",
          "section": "parties",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "studyTitle",
          "label": "שם המחקר",
          "type": "text",
          "required": true,
          "section": "study"
        },
        {
          "id": "purpose",
          "label": "מטרת ההסכם",
          "type": "text",
          "required": true,
          "section": "study"
        },
        {
          "id": "objectives",
          "label": "מטרות המחקר",
          "type": "text",
          "section": "study",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "researchQuestions",
          "label": "שאלות מחקר",
          "type": "tags",
          "section": "study",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "method",
          "label": "שיטת המחקר",
          "type": "text",
          "section": "study",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "population",
          "label": "אוכלוסיית המחקר",
          "type": "text",
          "section": "study",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "startDate",
          "label": "תחילת המחקר",
          "type": "date",
          "category": "deadline",
          "section": "study",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "endDate",
          "label": "סיום המחקר",
          "type": "date",
          "category": "deadline",
          "section": "study",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "applicationId",
          "label": "הבקשה שאושרה",
          "type": "id",
          "reference": "application",
          "section": "study"
        },
        {
          "id": "toolIds",
          "label": "כלים",
          "type": "tags",
          "section": "tools"
        },
        {
          "id": "questionnaireVersionIds",
          "label": "גרסאות שאלונים",
          "type": "tags",
          "itemType": "id",
          "reference": "instrument",
          "section": "tools"
        },
        {
          "id": "requestedPermissions",
          "label": "הרשאות מוצעות",
          "type": "tags",
          "choices": [
            "view_study",
            "edit_study",
            "manage_questionnaires",
            "view_aggregate_results",
            "view_pseudonymized_data",
            "view_identifiable_data",
            "view_document_content",
            "export_data",
            "manage_participants",
            "contact_participants",
            "manage_researchers",
            "manage_consent",
            "view_audit_log",
            "view_approved_findings",
            "download_approved_findings",
            "propose_analysis",
            "view_analysis_results",
            "comment_on_findings",
            "view_approved_pseudonymized_data",
            "export_approved_dataset",
            "view_study_progress",
            "view_approved_contributions"
          ],
          "category": "access",
          "section": "tools"
        },
        {
          "id": "accessTerms",
          "label": "תנאי גישה",
          "type": "text",
          "category": "access",
          "section": "tools"
        },
        {
          "id": "toolLimitations",
          "label": "מגבלות השימוש",
          "type": "text",
          "category": "access",
          "section": "tools"
        },
        {
          "id": "contributionIds",
          "label": "תרומות קשורות",
          "type": "tags",
          "itemType": "id",
          "reference": "contribution",
          "section": "contributions"
        },
        {
          "id": "ownerResponsibilities",
          "label": "אחריות בעלת המערכת",
          "type": "text",
          "category": "obligations",
          "section": "contributions",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "partnerResponsibilities",
          "label": "אחריות החוקרת",
          "type": "text",
          "category": "obligations",
          "section": "contributions",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "recognition",
          "label": "הכרה בתרומות",
          "type": "text",
          "section": "contributions"
        },
        {
          "id": "budgetId",
          "label": "תקציב קשור",
          "type": "id",
          "reference": "budget",
          "section": "sharedExpenses"
        },
        {
          "id": "currency",
          "label": "מטבע ההוצאות",
          "type": "enum",
          "choices": {
            "ILS": "שקל",
            "USD": "דולר ארה״ב",
            "EUR": "אירו",
            "GBP": "ליש״ט"
          },
          "category": "financial",
          "section": "sharedExpenses"
        },
        {
          "id": "sharedExpenses",
          "label": "הוצאות משותפות",
          "type": "rows",
          "fields": [
            {
              "id": "description",
              "label": "תיאור",
              "type": "text",
              "required": true
            },
            {
              "id": "amount",
              "label": "סכום",
              "type": "money",
              "category": "financial",
              "required": true
            },
            {
              "id": "party",
              "label": "הצד האחראי",
              "type": "enum",
              "choices": {
                "owner": "בעלת המערכת",
                "partner": "החוקרת",
                "shared": "שני הצדדים"
              },
              "required": true
            },
            {
              "id": "dueDate",
              "label": "מועד תשלום",
              "type": "date",
              "category": "deadline"
            },
            {
              "id": "terms",
              "label": "תנאים",
              "type": "text",
              "category": "obligations"
            },
            {
              "id": "contributionId",
              "label": "תרומה קשורה",
              "type": "id",
              "reference": "contribution"
            }
          ],
          "category": "financial",
          "section": "sharedExpenses"
        },
        {
          "id": "expenseApprovalTerms",
          "label": "תנאי אישור הוצאות",
          "type": "text",
          "category": "financial",
          "section": "sharedExpenses"
        },
        {
          "id": "professionalFees",
          "label": "שכר ושירותים מקצועיים",
          "type": "rows",
          "fields": [
            {
              "id": "service",
              "label": "שירות",
              "type": "text",
              "required": true
            },
            {
              "id": "provider",
              "label": "נותנת השירות",
              "type": "text",
              "required": true
            },
            {
              "id": "amount",
              "label": "סכום",
              "type": "money",
              "category": "financial",
              "required": true
            },
            {
              "id": "currency",
              "label": "מטבע",
              "type": "enum",
              "choices": {
                "ILS": "שקל",
                "USD": "דולר ארה״ב",
                "EUR": "אירו",
                "GBP": "ליש״ט"
              },
              "required": true
            },
            {
              "id": "dueDate",
              "label": "מועד תשלום",
              "type": "date",
              "category": "deadline"
            },
            {
              "id": "conditions",
              "label": "תנאי תשלום",
              "type": "text",
              "category": "obligations"
            }
          ],
          "category": "financial",
          "section": "professionalFees"
        },
        {
          "id": "taxTerms",
          "label": "תנאי מס ותיעוד שסופקו",
          "type": "text",
          "category": "financial",
          "section": "professionalFees"
        },
        {
          "id": "developmentScope",
          "label": "היקף הפיתוח",
          "type": "text",
          "section": "development"
        },
        {
          "id": "developmentResponsibilities",
          "label": "אחריות לפיתוח",
          "type": "text",
          "category": "obligations",
          "section": "development"
        },
        {
          "id": "milestones",
          "label": "אבני דרך",
          "type": "rows",
          "fields": [
            {
              "id": "title",
              "label": "אבן דרך",
              "type": "text",
              "required": true
            },
            {
              "id": "party",
              "label": "הצד האחראי",
              "type": "enum",
              "choices": {
                "owner": "בעלת המערכת",
                "partner": "החוקרת",
                "shared": "שני הצדדים"
              },
              "required": true
            },
            {
              "id": "dueDate",
              "label": "מועד יעד",
              "type": "date",
              "required": true,
              "category": "deadline"
            },
            {
              "id": "deliverable",
              "label": "תוצר",
              "type": "text",
              "required": true
            },
            {
              "id": "amount",
              "label": "סכום",
              "type": "money",
              "category": "financial"
            }
          ],
          "category": "obligations",
          "section": "development"
        },
        {
          "id": "ongoingSupport",
          "label": "תמיכה ותחזוקה",
          "type": "text",
          "category": "obligations",
          "section": "development"
        },
        {
          "id": "preExistingOwnerIP",
          "label": "זכויות קודמות של בעלת המערכת",
          "type": "text",
          "category": "IP",
          "section": "mutualIP"
        },
        {
          "id": "preExistingPartnerIP",
          "label": "זכויות קודמות של החוקרת",
          "type": "text",
          "category": "IP",
          "section": "mutualIP"
        },
        {
          "id": "newIPOwnership",
          "label": "זכויות בתוצרים חדשים",
          "type": "text",
          "category": "IP",
          "section": "mutualIP"
        },
        {
          "id": "usageLicence",
          "label": "רישיונות שימוש מוצעים",
          "type": "text",
          "category": "IP",
          "section": "mutualIP"
        },
        {
          "id": "publicationRights",
          "label": "זכויות פרסום מוצעות",
          "type": "text",
          "category": "IP",
          "section": "mutualIP"
        },
        {
          "id": "commercialRights",
          "label": "שימוש מסחרי מוצע",
          "type": "text",
          "category": "IP",
          "section": "mutualIP"
        },
        {
          "id": "attribution",
          "label": "ייחוס והכרה",
          "type": "text",
          "category": "IP",
          "section": "mutualIP"
        },
        {
          "id": "proposedIPAmendments",
          "label": "שינויים מוצעים בזכויות",
          "type": "text",
          "category": "IP",
          "section": "mutualIP"
        },
        {
          "id": "ipExplanationVersionId",
          "label": "גרסת הסבר קניין רוחני",
          "type": "id",
          "reference": "agreement_template_version",
          "required": true,
          "category": "IP",
          "section": "mutualIP"
        },
        {
          "id": "ethicsApproval",
          "label": "תיעוד אישור אתי",
          "type": "text",
          "category": "privacy",
          "section": "privacyEthics",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "consentProtocolVersionId",
          "label": "גרסת פרוטוקול הסכמה",
          "type": "id",
          "reference": "consent",
          "category": "privacy",
          "section": "privacyEthics"
        },
        {
          "id": "privacyTerms",
          "label": "תנאי פרטיות",
          "type": "text",
          "category": "privacy",
          "section": "privacyEthics"
        },
        {
          "id": "dataSecurity",
          "label": "אבטחת מידע",
          "type": "text",
          "category": "privacy",
          "section": "privacyEthics"
        },
        {
          "id": "retentionTerms",
          "label": "שמירה ומחיקה",
          "type": "text",
          "category": "privacy",
          "section": "privacyEthics"
        },
        {
          "id": "withdrawalTerms",
          "label": "פרישה מהמחקר",
          "type": "text",
          "category": "privacy",
          "section": "privacyEthics"
        },
        {
          "id": "confidentiality",
          "label": "סודיות",
          "type": "text",
          "category": "privacy",
          "section": "privacyEthics"
        },
        {
          "id": "effectiveDate",
          "label": "תחילת תוקף מוצעת",
          "type": "date",
          "required": true,
          "category": "deadline",
          "section": "durationTermination"
        },
        {
          "id": "terminationDate",
          "label": "סיום תוקף מוצע",
          "type": "date",
          "category": "deadline",
          "section": "durationTermination",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "terminationNoticeDays",
          "label": "ימי הודעה מראש",
          "type": "integer",
          "category": "deadline",
          "section": "durationTermination",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "terminationTerms",
          "label": "תנאי סיום שסופקו",
          "type": "text",
          "category": "obligations",
          "section": "durationTermination",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "postTermination",
          "label": "אחריות לאחר סיום",
          "type": "text",
          "category": "obligations",
          "section": "durationTermination",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          }
        },
        {
          "id": "annexDocumentIds",
          "label": "מסמכי נספחים",
          "type": "tags",
          "itemType": "id",
          "reference": "document",
          "section": "annexes"
        },
        {
          "id": "customClauses",
          "label": "סעיפים מוצעים נוספים",
          "type": "rows",
          "fields": [
            {
              "id": "sectionId",
              "label": "פרק",
              "type": "enum",
              "choices": {
                "parties": "פרטי הצדדים",
                "study": "המחקר ומטרותיו",
                "tools": "כלים, שאלונים והרשאות",
                "contributions": "תרומות הצדדים",
                "sharedExpenses": "הוצאות משותפות",
                "professionalFees": "שכר ושירותים מקצועיים",
                "development": "פיתוח ותמיכה",
                "mutualIP": "קניין רוחני הדדי",
                "privacyEthics": "פרטיות ואתיקה",
                "durationTermination": "תקופה וסיום",
                "annexes": "נספחים וסעיפים נוספים",
                "reviewSigning": "עיון, אישור וחתימה"
              },
              "required": true
            },
            {
              "id": "title",
              "label": "כותרת הסעיף",
              "type": "text",
              "required": true
            },
            {
              "id": "text",
              "label": "נוסח מוצע",
              "type": "text",
              "required": true
            }
          ],
          "category": "obligations",
          "section": "annexes"
        },
        {
          "id": "templateVersionId",
          "label": "גרסת תבנית מאושרת",
          "type": "id",
          "reference": "agreement_template_version",
          "required": true,
          "section": "reviewSigning"
        },
        {
          "id": "ipReadAcknowledgement",
          "label": "קראתי את הסבר הקניין הרוחני",
          "type": "boolean",
          "section": "reviewSigning"
        },
        {
          "id": "reviewNotes",
          "label": "הערות לעיון",
          "type": "text",
          "section": "reviewSigning"
        },
        {
          "id": "amendsAgreementVersionId",
          "label": "גרסה חתומה לתיקון",
          "type": "id",
          "reference": "agreement_version",
          "section": "reviewSigning"
        },
        {
          "id": "guidedVersion",
          "label": "גרסת ההסכם המונחה",
          "type": "enum",
          "choices": {
            "4": "גרסה 4"
          },
          "section": "parties"
        },
        {
          "id": "ownerPartyKind",
          "label": "הגורם המתקשר מטעם בעלת המערכת",
          "type": "enum",
          "choices": {
            "individual": "אדם פרטי",
            "institution": "מוסד",
            "both": "אדם ומוסד"
          },
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "parties"
        },
        {
          "id": "partnerPartyKind",
          "label": "הגורם המתקשר מטעם השותפה",
          "type": "enum",
          "choices": {
            "individual": "אדם פרטי",
            "institution": "מוסד",
            "both": "אדם ומוסד"
          },
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "parties"
        },
        {
          "id": "ownerRegistration",
          "label": "מספר זיהוי או רישום בעלת המערכת",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "parties"
        },
        {
          "id": "partnerRegistration",
          "label": "מספר זיהוי או רישום השותפה",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "parties"
        },
        {
          "id": "ownerSignatoryRole",
          "label": "תפקיד מורשית חתימת בעלת המערכת",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "parties"
        },
        {
          "id": "partnerSignatoryRole",
          "label": "תפקיד מורשית חתימת השותפה",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "parties"
        },
        {
          "id": "institutionApproval",
          "label": "אישור מוסדי להתקשרות או אי תחולה",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "parties"
        },
        {
          "id": "leadResearcher",
          "label": "שם החוקרת האחראית",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "parties"
        },
        {
          "id": "leadResearcherRole",
          "label": "תפקיד החוקרת האחראית",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "parties"
        },
        {
          "id": "leadResearcherInstitution",
          "label": "מוסד החוקרת האחראית או אי תחולה",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "parties"
        },
        {
          "id": "agreementContacts",
          "label": "אנשי קשר מקצועיים ולהודעות",
          "type": "rows",
          "fields": [
            {
              "id": "party",
              "label": "צד",
              "type": "enum",
              "choices": {
                "owner": "בעלת המערכת",
                "partner": "החוקרת",
                "shared": "שני הצדדים"
              },
              "required": true
            },
            {
              "id": "name",
              "label": "שם",
              "type": "text",
              "required": true
            },
            {
              "id": "role",
              "label": "תפקיד",
              "type": "text",
              "required": true
            },
            {
              "id": "email",
              "label": "דוא״ל",
              "type": "email",
              "required": true
            },
            {
              "id": "phone",
              "label": "טלפון",
              "type": "text"
            },
            {
              "id": "purpose",
              "label": "תחום פנייה",
              "type": "text",
              "required": true
            }
          ],
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "parties"
        },
        {
          "id": "studyIdentifier",
          "label": "מזהה המחקר",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "study"
        },
        {
          "id": "centralResearchQuestion",
          "label": "שאלת המחקר המרכזית",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "study"
        },
        {
          "id": "researchLimits",
          "label": "מגבלות המסקנות",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "study"
        },
        {
          "id": "humanAIReview",
          "label": "אחריות לבדיקה אנושית של תוצרי AI",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "study"
        },
        {
          "id": "freeTierTerms",
          "label": "שימוש חינמי וטיפול בהגעה למכסה",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "category": "financial",
          "section": "sharedExpenses"
        },
        {
          "id": "developmentTasks",
          "label": "משימות התאמה ופיתוח",
          "type": "rows",
          "fields": [
            {
              "id": "school",
              "label": "בית הספר והצורך",
              "type": "text",
              "required": true
            },
            {
              "id": "users",
              "label": "משתמשות",
              "type": "text",
              "required": true
            },
            {
              "id": "requestedChange",
              "label": "השינוי המבוקש",
              "type": "text",
              "required": true
            },
            {
              "id": "deliverable",
              "label": "תוצר מדיד",
              "type": "text",
              "required": true
            },
            {
              "id": "performer",
              "label": "מבצעת",
              "type": "text",
              "required": true
            },
            {
              "id": "milestones",
              "label": "אבני דרך",
              "type": "text",
              "required": true
            },
            {
              "id": "testEnvironment",
              "label": "סביבת בדיקה",
              "type": "text",
              "required": true
            },
            {
              "id": "acceptance",
              "label": "תנאי קבלה והגורם המאשר",
              "type": "text",
              "required": true
            },
            {
              "id": "training",
              "label": "הדרכה",
              "type": "text",
              "required": true
            },
            {
              "id": "usabilityEvaluation",
              "label": "בדיקת התאמה ושימושיות",
              "type": "text",
              "required": true
            },
            {
              "id": "maintenance",
              "label": "אחריות לתחזוקה",
              "type": "text",
              "required": true
            },
            {
              "id": "rights",
              "label": "זכויות בתוצר",
              "type": "text",
              "required": true
            },
            {
              "id": "budget",
              "label": "תקציב",
              "type": "money",
              "category": "financial"
            },
            {
              "id": "currency",
              "label": "מטבע",
              "type": "enum",
              "choices": {
                "ILS": "שקל",
                "USD": "דולר ארה״ב",
                "EUR": "אירו",
                "GBP": "ליש״ט"
              }
            },
            {
              "id": "dueDate",
              "label": "מועד",
              "type": "date"
            }
          ],
          "category": "obligations",
          "section": "development"
        },
        {
          "id": "supportChannels",
          "label": "ערוצי תמיכה",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "development"
        },
        {
          "id": "supportDays",
          "label": "ימי תמיכה",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "development"
        },
        {
          "id": "supportExtent",
          "label": "היקף תמיכה",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "development"
        },
        {
          "id": "supportResponse",
          "label": "זמני מענה ותחזוקה",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "development"
        },
        {
          "id": "supportEscalation",
          "label": "טיפול בהסלמה",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "development"
        },
        {
          "id": "consentConfiguration",
          "label": "הסכמות למשתתפים ולקטינים או אי תחולה",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "category": "privacy",
          "section": "privacyEthics"
        },
        {
          "id": "confidentialScope",
          "label": "סוגי מידע סודי",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "category": "privacy",
          "section": "privacyEthics"
        },
        {
          "id": "confidentialDuration",
          "label": "משך הסודיות",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "category": "privacy",
          "section": "privacyEthics"
        },
        {
          "id": "confidentialExceptions",
          "label": "חריגים וחובות גילוי",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "category": "privacy",
          "section": "privacyEthics"
        },
        {
          "id": "breachCureDays",
          "label": "ימי תיקון הפרה",
          "type": "integer",
          "category": "deadline",
          "section": "durationTermination"
        },
        {
          "id": "breachNoticeTerms",
          "label": "הודעה על הפרה ותנאי תיקון או אי תחולה",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "category": "obligations",
          "section": "durationTermination"
        },
        {
          "id": "suspensionTerms",
          "label": "עצירה והגבלת גישה",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "category": "obligations",
          "section": "durationTermination"
        },
        {
          "id": "handoverTerms",
          "label": "העברת תוצרים וסגירת הרשאות",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "category": "obligations",
          "section": "durationTermination"
        },
        {
          "id": "finalSettlement",
          "label": "התחשבנות בסיום",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "category": "obligations",
          "section": "durationTermination"
        },
        {
          "id": "publicationReviewPeriod",
          "label": "תקופת עיון מוקדם בפרסום",
          "type": "integer",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "category": "deadline",
          "section": "annexes"
        },
        {
          "id": "publicationReviewUnit",
          "label": "יחידת תקופת העיון",
          "type": "enum",
          "choices": {
            "days": "ימים",
            "business_days": "ימי עסקים"
          },
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "annexes"
        },
        {
          "id": "authorshipTerms",
          "label": "מחברות וקרדיט לפי התרומה",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "annexes"
        },
        {
          "id": "logoUseTerms",
          "label": "הרשאה לשם, ללוגו ולשיווק",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "annexes"
        },
        {
          "id": "disputeContacts",
          "label": "אנשי קשר וגורמים מוסמכים למחלוקת",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "annexes"
        },
        {
          "id": "disputePeriod",
          "label": "פרק זמן ליישוב מחלוקת",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "annexes"
        },
        {
          "id": "documentPrecedence",
          "label": "סדר עדיפות בין המסמכים",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "annexes"
        },
        {
          "id": "governingLaw",
          "label": "דין מוסכם",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "annexes"
        },
        {
          "id": "jurisdiction",
          "label": "סמכות שיפוט מוסכמת",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "annexes"
        },
        {
          "id": "liabilityTerms",
          "label": "אחריות ופיצוי או אי תחולה מנומקת",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "annexes"
        },
        {
          "id": "insuranceTerms",
          "label": "ביטוח או אי תחולה מנומקת",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "annexes"
        },
        {
          "id": "finalVersionLabel",
          "label": "מספר הגרסה הסופית",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "reviewSigning"
        },
        {
          "id": "finalAnnexReferences",
          "label": "גרסאות הנספחים הנבחרים",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "reviewSigning"
        },
        {
          "id": "signerIdentityChecks",
          "label": "בדיקת זהות וסמכות החותמות",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "reviewSigning"
        },
        {
          "id": "signatureProvider",
          "label": "ספק חתימה מוצע",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "reviewSigning"
        },
        {
          "id": "signatureType",
          "label": "סוג חתימה ודרישות מוסד",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "reviewSigning"
        },
        {
          "id": "signaturePolicy",
          "label": "מדיניות חתימה מוסכמת",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "reviewSigning"
        },
        {
          "id": "signatureVerification",
          "label": "ראיות ובדיקות אימות נדרשות",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "reviewSigning"
        },
        {
          "id": "signingConsentTerms",
          "label": "הסכמה לחתום",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "reviewSigning"
        },
        {
          "id": "signedStorage",
          "label": "מקום שמירה והרשאות לעותק חתום",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "reviewSigning"
        },
        {
          "id": "activationConditions",
          "label": "תנאי תחילת הפעילות",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "reviewSigning"
        },
        {
          "id": "copyRecipients",
          "label": "נמעני עותק ודרך מסירה",
          "type": "rows",
          "fields": [
            {
              "id": "party",
              "label": "צד",
              "type": "enum",
              "choices": {
                "owner": "בעלת המערכת",
                "partner": "החוקרת",
                "shared": "שני הצדדים"
              },
              "required": true
            },
            {
              "id": "name",
              "label": "שם",
              "type": "text",
              "required": true
            },
            {
              "id": "email",
              "label": "דוא״ל",
              "type": "email",
              "required": true
            },
            {
              "id": "deliveryMethod",
              "label": "אופן מסירה",
              "type": "text",
              "required": true
            }
          ],
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "reviewSigning"
        },
        {
          "id": "annexAStatus",
          "label": "תחולת נספח A",
          "type": "enum",
          "choices": {
            "applicable": "נכלל בהסכם",
            "not_applicable": "לא חל, עם נימוק"
          },
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "study"
        },
        {
          "id": "annexAReason",
          "label": "נימוק לאי תחולת נספח A",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "annexAStatus",
            "equals": "not_applicable"
          },
          "section": "study"
        },
        {
          "id": "annexA",
          "label": "נספח A: תוכנית המחקר, מועדים ואחריות",
          "type": "rows",
          "fields": [
            {
              "id": "stage",
              "label": "שלב המחקר",
              "type": "text",
              "required": true
            },
            {
              "id": "questions",
              "label": "שאלות ושיטה",
              "type": "text",
              "required": true
            },
            {
              "id": "population",
              "label": "אוכלוסייה",
              "type": "text",
              "required": true
            },
            {
              "id": "sites",
              "label": "מסגרות חינוכיות",
              "type": "text",
              "required": true
            },
            {
              "id": "recruitment",
              "label": "דרך גיוס",
              "type": "text",
              "required": true
            },
            {
              "id": "measurementVersions",
              "label": "כלי מדידה, מקור וגרסה",
              "type": "text",
              "required": true
            },
            {
              "id": "responsible",
              "label": "אחראית לשלב",
              "type": "text",
              "required": true
            },
            {
              "id": "deliverables",
              "label": "תוצרים",
              "type": "text",
              "required": true
            },
            {
              "id": "schoolAdaptation",
              "label": "התאמה לבית הספר",
              "type": "text",
              "required": true
            },
            {
              "id": "adaptationEvaluation",
              "label": "בדיקת ההתאמה",
              "type": "text",
              "required": true
            },
            {
              "id": "permits",
              "label": "היתרים ואישורים",
              "type": "text",
              "required": true
            },
            {
              "id": "terminationHandover",
              "label": "העברת תוצרים בסיום",
              "type": "text",
              "required": true
            },
            {
              "id": "populationSize",
              "label": "היקף משתתפים",
              "type": "integer",
              "required": true
            },
            {
              "id": "startDate",
              "label": "התחלה",
              "type": "date",
              "required": true
            },
            {
              "id": "endDate",
              "label": "סיום",
              "type": "date",
              "required": true
            }
          ],
          "required": true,
          "requiredWhen": {
            "field": "annexAStatus",
            "equals": "applicable"
          },
          "category": "content",
          "section": "study"
        },
        {
          "id": "annexBStatus",
          "label": "תחולת נספח B",
          "type": "enum",
          "choices": {
            "applicable": "נכלל בהסכם",
            "not_applicable": "לא חל, עם נימוק"
          },
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "tools"
        },
        {
          "id": "annexBReason",
          "label": "נימוק לאי תחולת נספח B",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "annexBStatus",
            "equals": "not_applicable"
          },
          "section": "tools"
        },
        {
          "id": "annexB",
          "label": "נספח B: כלים והרשאות",
          "type": "rows",
          "fields": [
            {
              "id": "tool",
              "label": "כלי או שאלון",
              "type": "text",
              "required": true
            },
            {
              "id": "source",
              "label": "מקור",
              "type": "text",
              "required": true
            },
            {
              "id": "version",
              "label": "גרסה",
              "type": "text",
              "required": true
            },
            {
              "id": "dataScope",
              "label": "מידע מותר",
              "type": "text",
              "required": true
            },
            {
              "id": "exportTerms",
              "label": "ייצוא מותר או אי תחולה",
              "type": "text",
              "required": true
            },
            {
              "id": "quota",
              "label": "מכסות והיקף",
              "type": "text",
              "required": true
            },
            {
              "id": "training",
              "label": "הדרכה",
              "type": "text",
              "required": true
            },
            {
              "id": "humanReview",
              "label": "בדיקה אנושית של תוצרי AI",
              "type": "text",
              "required": true
            },
            {
              "id": "authorizedUsers",
              "label": "משתמשות מורשות",
              "type": "tags",
              "required": true
            },
            {
              "id": "actions",
              "label": "פעולות מותרות",
              "type": "tags",
              "required": true
            },
            {
              "id": "startDate",
              "label": "התחלה",
              "type": "date",
              "required": true
            },
            {
              "id": "endDate",
              "label": "סיום",
              "type": "date",
              "required": true
            }
          ],
          "required": true,
          "requiredWhen": {
            "field": "annexBStatus",
            "equals": "applicable"
          },
          "category": "access",
          "section": "tools"
        },
        {
          "id": "annexCStatus",
          "label": "תחולת נספח C",
          "type": "enum",
          "choices": {
            "applicable": "נכלל בהסכם",
            "not_applicable": "לא חל, עם נימוק"
          },
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "sharedExpenses"
        },
        {
          "id": "annexCReason",
          "label": "נימוק לאי תחולת נספח C",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "annexCStatus",
            "equals": "not_applicable"
          },
          "section": "sharedExpenses"
        },
        {
          "id": "annexC",
          "label": "נספח C: תקציב, הוצאות ושכר",
          "type": "rows",
          "fields": [
            {
              "id": "description",
              "label": "שירות וצורך",
              "type": "text",
              "required": true
            },
            {
              "id": "purpose",
              "label": "מטרה ותכולה",
              "type": "text",
              "required": true
            },
            {
              "id": "calculationBasis",
              "label": "בסיס חישוב ותמחור",
              "type": "text",
              "required": true
            },
            {
              "id": "taxTerms",
              "label": "מסים או אי תחולה",
              "type": "text",
              "required": true
            },
            {
              "id": "shareTerms",
              "label": "חלוקת עלויות",
              "type": "text",
              "required": true
            },
            {
              "id": "payer",
              "label": "משלמת בפועל",
              "type": "text",
              "required": true
            },
            {
              "id": "payee",
              "label": "מקבלת התשלום",
              "type": "text",
              "required": true
            },
            {
              "id": "approver",
              "label": "גורם מאשר",
              "type": "text",
              "required": true
            },
            {
              "id": "approvalEvidence",
              "label": "אישור ואסמכתאות או טרם אושר",
              "type": "text",
              "required": true
            },
            {
              "id": "paymentTerms",
              "label": "תנאי ומועד תשלום",
              "type": "text",
              "required": true
            },
            {
              "id": "invoiceTerms",
              "label": "מסמכי חיוב או אי תחולה",
              "type": "text",
              "required": true
            },
            {
              "id": "partialWorkTerms",
              "label": "עבודה חלקית וסיום מוקדם",
              "type": "text",
              "required": true
            },
            {
              "id": "unpaidTerms",
              "label": "החלטה על תמורה או תרומה ללא תשלום",
              "type": "text",
              "required": true
            },
            {
              "id": "kind",
              "label": "סוג",
              "type": "enum",
              "choices": {
                "operating": "הוצאה תפעולית",
                "service": "שירות מקצועי"
              },
              "required": true
            },
            {
              "id": "estimatedAmount",
              "label": "הערכה",
              "type": "money",
              "category": "financial",
              "required": true
            },
            {
              "id": "approvedCap",
              "label": "תקרה מוצעת לאישור",
              "type": "money",
              "category": "financial",
              "required": true
            },
            {
              "id": "ownerShare",
              "label": "חלק בעלת המערכת",
              "type": "money",
              "category": "financial",
              "required": true
            },
            {
              "id": "partnerShare",
              "label": "חלק השותפה",
              "type": "money",
              "category": "financial",
              "required": true
            },
            {
              "id": "actualAmount",
              "label": "ביצוע מתועד",
              "type": "money",
              "category": "financial"
            },
            {
              "id": "currency",
              "label": "מטבע",
              "type": "enum",
              "choices": {
                "ILS": "שקל",
                "USD": "דולר ארה״ב",
                "EUR": "אירו",
                "GBP": "ליש״ט"
              },
              "required": true
            },
            {
              "id": "settlementDate",
              "label": "מועד התחשבנות",
              "type": "date"
            },
            {
              "id": "pricingMethod",
              "label": "שיטת תמחור השירות",
              "type": "enum",
              "choices": {
                "fixed": "לפי תוצר",
                "hourly": "לפי שעה",
                "mixed": "שילוב מוגדר",
                "unpaid": "תרומה ללא תשלום"
              },
              "required": true,
              "requiredWhen": {
                "field": "kind",
                "equals": "service"
              }
            },
            {
              "id": "serviceAmount",
              "label": "סכום השירות",
              "type": "money",
              "category": "financial",
              "required": true,
              "requiredWhen": {
                "field": "kind",
                "equals": "service"
              }
            },
            {
              "id": "provider",
              "label": "נותנת שירות",
              "type": "text",
              "required": true,
              "requiredWhen": {
                "field": "kind",
                "equals": "service"
              }
            },
            {
              "id": "serviceRecipient",
              "label": "מקבלת השירות",
              "type": "text",
              "required": true,
              "requiredWhen": {
                "field": "kind",
                "equals": "service"
              }
            },
            {
              "id": "deliverable",
              "label": "תוצר השירות",
              "type": "text",
              "required": true,
              "requiredWhen": {
                "field": "kind",
                "equals": "service"
              }
            },
            {
              "id": "hourCap",
              "label": "תקרת שעות והיקף או אי תחולה",
              "type": "text",
              "required": true,
              "requiredWhen": {
                "field": "kind",
                "equals": "service"
              }
            },
            {
              "id": "acceptance",
              "label": "קבלת התוצר",
              "type": "text",
              "required": true,
              "requiredWhen": {
                "field": "kind",
                "equals": "service"
              }
            },
            {
              "id": "credit",
              "label": "קרדיט לשירות או אי תחולה",
              "type": "text",
              "required": true,
              "requiredWhen": {
                "field": "kind",
                "equals": "service"
              }
            }
          ],
          "required": true,
          "requiredWhen": {
            "field": "annexCStatus",
            "equals": "applicable"
          },
          "category": "financial",
          "section": "sharedExpenses"
        },
        {
          "id": "annexDStatus",
          "label": "תחולת נספח D",
          "type": "enum",
          "choices": {
            "applicable": "נכלל בהסכם",
            "not_applicable": "לא חל, עם נימוק"
          },
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "contributions"
        },
        {
          "id": "annexDReason",
          "label": "נימוק לאי תחולת נספח D",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "annexDStatus",
            "equals": "not_applicable"
          },
          "section": "contributions"
        },
        {
          "id": "annexD",
          "label": "נספח D: תרומות ופיתוח",
          "type": "rows",
          "fields": [
            {
              "id": "contributionIdentifier",
              "label": "מזהה תרומה",
              "type": "text",
              "required": true
            },
            {
              "id": "contributor",
              "label": "תורמת",
              "type": "text",
              "required": true
            },
            {
              "id": "institution",
              "label": "מוסד או אי תחולה",
              "type": "text",
              "required": true
            },
            {
              "id": "description",
              "label": "תיאור",
              "type": "text",
              "required": true
            },
            {
              "id": "deliverable",
              "label": "תוצר",
              "type": "text",
              "required": true
            },
            {
              "id": "milestones",
              "label": "אבני דרך",
              "type": "text",
              "required": true
            },
            {
              "id": "acceptance",
              "label": "בדיקת ביצוע",
              "type": "text",
              "required": true
            },
            {
              "id": "ownerDuties",
              "label": "התחייבות מוצעת לבעלת המערכת",
              "type": "text",
              "required": true
            },
            {
              "id": "requestedRecognition",
              "label": "קרדיט מבוקש",
              "type": "text",
              "required": true
            },
            {
              "id": "requestedRights",
              "label": "זכויות מבוקשות",
              "type": "text",
              "required": true
            },
            {
              "id": "agreedRecognition",
              "label": "קרדיט מוסכם או טרם הוסכם",
              "type": "text",
              "required": true
            },
            {
              "id": "agreedRights",
              "label": "זכויות מוסכמות או טרם הוסכמו",
              "type": "text",
              "required": true
            },
            {
              "id": "agreedConditions",
              "label": "תנאים מוסכמים או טרם הוסכמו",
              "type": "text",
              "required": true
            },
            {
              "id": "confirmingVersion",
              "label": "מסמך וגרסה מאשרים או טרם אושר",
              "type": "text",
              "required": true
            },
            {
              "id": "category",
              "label": "סוג תרומה",
              "type": "enum",
              "choices": {
                "scientific": "תרומה מדעית",
                "methodological": "תרומה מתודולוגית",
                "questionnaires": "שאלונים",
                "educational_content": "תוכן חינוכי",
                "technology": "טכנולוגיה",
                "funding": "מימון",
                "professional_services": "שירותים מקצועיים",
                "other": "אחר"
              },
              "required": true
            },
            {
              "id": "dueDate",
              "label": "מועד",
              "type": "date",
              "required": true
            },
            {
              "id": "requestedPayment",
              "label": "תשלום מבוקש",
              "type": "money",
              "category": "financial"
            },
            {
              "id": "agreedPayment",
              "label": "תשלום שהוסכם",
              "type": "money",
              "category": "financial"
            },
            {
              "id": "currency",
              "label": "מטבע",
              "type": "enum",
              "choices": {
                "ILS": "שקל",
                "USD": "דולר ארה״ב",
                "EUR": "אירו",
                "GBP": "ליש״ט"
              }
            },
            {
              "id": "executionEvidence",
              "label": "ראיות לביצוע",
              "type": "text"
            }
          ],
          "required": true,
          "requiredWhen": {
            "field": "annexDStatus",
            "equals": "applicable"
          },
          "category": "obligations",
          "section": "contributions"
        },
        {
          "id": "annexEStatus",
          "label": "תחולת נספח E",
          "type": "enum",
          "choices": {
            "applicable": "נכלל בהסכם",
            "not_applicable": "לא חל, עם נימוק"
          },
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "privacyEthics"
        },
        {
          "id": "annexEReason",
          "label": "נימוק לאי תחולת נספח E",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "annexEStatus",
            "equals": "not_applicable"
          },
          "section": "privacyEthics"
        },
        {
          "id": "annexE",
          "label": "נספח E: פרטיות, הסכמות ואתיקה",
          "type": "rows",
          "fields": [
            {
              "id": "dataCategories",
              "label": "סוגי מידע",
              "type": "text",
              "required": true
            },
            {
              "id": "purposes",
              "label": "מטרות עיבוד",
              "type": "text",
              "required": true
            },
            {
              "id": "partyRoles",
              "label": "תפקידי הצדדים בעיבוד",
              "type": "text",
              "required": true
            },
            {
              "id": "providers",
              "label": "ספקי עיבוד או אין ספק",
              "type": "text",
              "required": true
            },
            {
              "id": "transferBasis",
              "label": "תנאי ובסיס העברה או אין העברה",
              "type": "text",
              "required": true
            },
            {
              "id": "storageLocation",
              "label": "מקום אחסון",
              "type": "text",
              "required": true
            },
            {
              "id": "retention",
              "label": "תקופות שמירה ובסיסן",
              "type": "text",
              "required": true
            },
            {
              "id": "backups",
              "label": "גיבויים ושמירתם",
              "type": "text",
              "required": true
            },
            {
              "id": "deletion",
              "label": "מחיקה ומגבלותיה",
              "type": "text",
              "required": true
            },
            {
              "id": "withdrawal",
              "label": "פרישה ומגבלות לאחר איגום",
              "type": "text",
              "required": true
            },
            {
              "id": "ethicsReferences",
              "label": "אישורי אתיקה ומוסד",
              "type": "text",
              "required": true
            },
            {
              "id": "participantConsent",
              "label": "הסכמות וקטינים או אי תחולה",
              "type": "text",
              "required": true
            },
            {
              "id": "securityResponsible",
              "label": "אחראית אבטחה",
              "type": "text",
              "required": true
            },
            {
              "id": "securityMeasures",
              "label": "הפרדת הרשאות והגנת מסמכים",
              "type": "text",
              "required": true
            },
            {
              "id": "incidentHandling",
              "label": "בקשות ואירועים",
              "type": "text",
              "required": true
            },
            {
              "id": "contact",
              "label": "פרטי פנייה",
              "type": "text",
              "required": true
            },
            {
              "id": "terminationHandling",
              "label": "סיום, שמירה וסגירת גישה",
              "type": "text",
              "required": true
            },
            {
              "id": "authorizedPeople",
              "label": "מורשות גישה",
              "type": "tags",
              "required": true
            }
          ],
          "required": true,
          "requiredWhen": {
            "field": "annexEStatus",
            "equals": "applicable"
          },
          "category": "privacy",
          "section": "privacyEthics"
        },
        {
          "id": "annexFStatus",
          "label": "תחולת נספח F",
          "type": "enum",
          "choices": {
            "applicable": "נכלל בהסכם",
            "not_applicable": "לא חל, עם נימוק"
          },
          "required": true,
          "requiredWhen": {
            "field": "guidedVersion",
            "equals": "4"
          },
          "section": "mutualIP"
        },
        {
          "id": "annexFReason",
          "label": "נימוק לאי תחולת נספח F",
          "type": "text",
          "required": true,
          "requiredWhen": {
            "field": "annexFStatus",
            "equals": "not_applicable"
          },
          "section": "mutualIP"
        },
        {
          "id": "annexF",
          "label": "נספח F: תוצרים, זכויות ופרסום",
          "type": "rows",
          "fields": [
            {
              "id": "description",
              "label": "תיאור נכס או תוצר",
              "type": "text",
              "required": true
            },
            {
              "id": "creators",
              "label": "יוצרות",
              "type": "text",
              "required": true
            },
            {
              "id": "rightsHolders",
              "label": "בעלי זכויות וסמכות",
              "type": "text",
              "required": true
            },
            {
              "id": "ownership",
              "label": "בעלות מוסכמת",
              "type": "text",
              "required": true
            },
            {
              "id": "licence",
              "label": "רישיון או אי תחולה",
              "type": "text",
              "required": true
            },
            {
              "id": "permittedUses",
              "label": "תחומים ושימושים מותרים",
              "type": "text",
              "required": true
            },
            {
              "id": "modification",
              "label": "שינוי",
              "type": "text",
              "required": true
            },
            {
              "id": "distribution",
              "label": "הפצה",
              "type": "text",
              "required": true
            },
            {
              "id": "commercialUse",
              "label": "שימוש מסחרי",
              "type": "text",
              "required": true
            },
            {
              "id": "term",
              "label": "תקופת הרשאה",
              "type": "text",
              "required": true
            },
            {
              "id": "compensation",
              "label": "תמורה או אי תחולה",
              "type": "text",
              "required": true
            },
            {
              "id": "publication",
              "label": "פרסום",
              "type": "text",
              "required": true
            },
            {
              "id": "credit",
              "label": "קרדיט",
              "type": "text",
              "required": true
            },
            {
              "id": "assetKind",
              "label": "סוג נכס",
              "type": "enum",
              "choices": {
                "owner_prior": "נכס קודם של בעלת המערכת",
                "partner_prior": "נכס קודם של השותפה או המוסד",
                "third_party": "נכס צד שלישי",
                "new_output": "תוצר חדש"
              },
              "required": true
            }
          ],
          "required": true,
          "requiredWhen": {
            "field": "annexFStatus",
            "equals": "applicable"
          },
          "category": "IP",
          "section": "mutualIP"
        }
      ]
    },
    "agreement_template": {
      "label": "תבנית הסכם",
      "fields": [
        {
          "id": "title",
          "label": "כותרת",
          "type": "text",
          "required": true,
          "maxLength": 240
        },
        {
          "id": "templateVersion",
          "label": "גרסת התבנית",
          "type": "text",
          "required": true
        },
        {
          "id": "explanationVersion",
          "label": "גרסת הסבר הקניין הרוחני",
          "type": "text",
          "required": true
        },
        {
          "id": "sectionClauses",
          "label": "סעיפים שסופקו ואושרו",
          "type": "rows",
          "fields": [
            {
              "id": "sectionId",
              "label": "פרק",
              "type": "enum",
              "choices": {
                "parties": "פרטי הצדדים",
                "study": "המחקר ומטרותיו",
                "tools": "כלים, שאלונים והרשאות",
                "contributions": "תרומות הצדדים",
                "sharedExpenses": "הוצאות משותפות",
                "professionalFees": "שכר ושירותים מקצועיים",
                "development": "פיתוח ותמיכה",
                "mutualIP": "קניין רוחני הדדי",
                "privacyEthics": "פרטיות ואתיקה",
                "durationTermination": "תקופה וסיום",
                "annexes": "נספחים וסעיפים נוספים",
                "reviewSigning": "עיון, אישור וחתימה"
              },
              "required": true
            },
            {
              "id": "text",
              "label": "טקסט שסופק",
              "type": "text",
              "required": true
            }
          ],
          "required": true
        },
        {
          "id": "ipExplanation",
          "label": "הסבר קניין רוחני שסופק",
          "type": "text",
          "required": true
        },
        {
          "id": "mutualIPClause",
          "label": "סעיף הדדיות שסופק",
          "type": "text",
          "required": true
        },
        {
          "id": "requiredFieldIds",
          "label": "שדות להשלמת ההסכם",
          "type": "tags"
        }
      ]
    },
    "budget": {
      "label": "תקציב",
      "fields": [
        {
          "id": "title",
          "label": "כותרת",
          "type": "text",
          "required": true,
          "maxLength": 240
        },
        {
          "id": "currency",
          "label": "מטבע",
          "type": "enum",
          "choices": {
            "ILS": "שקל",
            "USD": "דולר ארה״ב",
            "EUR": "אירו",
            "GBP": "ליש״ט"
          },
          "required": true
        },
        {
          "id": "items",
          "label": "סעיפי תקציב",
          "type": "rows",
          "fields": [
            {
              "id": "description",
              "label": "תיאור",
              "type": "text",
              "required": true
            },
            {
              "id": "amount",
              "label": "סכום",
              "type": "money",
              "category": "financial",
              "required": true
            },
            {
              "id": "party",
              "label": "הצד האחראי",
              "type": "enum",
              "choices": {
                "owner": "בעלת המערכת",
                "partner": "החוקרת",
                "shared": "שני הצדדים"
              },
              "required": true
            },
            {
              "id": "dueDate",
              "label": "מועד תשלום",
              "type": "date",
              "category": "deadline"
            },
            {
              "id": "terms",
              "label": "תנאים",
              "type": "text",
              "category": "obligations"
            },
            {
              "id": "contributionId",
              "label": "תרומה קשורה",
              "type": "id",
              "reference": "contribution"
            }
          ],
          "required": true,
          "category": "financial"
        },
        {
          "id": "fundingSource",
          "label": "מקור מימון",
          "type": "text"
        },
        {
          "id": "notes",
          "label": "הערות",
          "type": "text"
        },
        {
          "id": "supportingDocumentIds",
          "label": "מסמכים תומכים",
          "type": "tags",
          "itemType": "id",
          "reference": "document"
        }
      ]
    },
    "obligation": {
      "label": "התחייבות",
      "fields": [
        {
          "id": "title",
          "label": "כותרת",
          "type": "text",
          "required": true,
          "maxLength": 240
        },
        {
          "id": "sourceAgreementId",
          "label": "הסכם מקור",
          "type": "id",
          "reference": "agreement",
          "required": true
        },
        {
          "id": "sourceAgreementVersionId",
          "label": "גרסת הסכם חתומה",
          "type": "id",
          "reference": "agreement_version",
          "required": true
        },
        {
          "id": "clauseReference",
          "label": "הפניה לסעיף",
          "type": "text",
          "required": true
        },
        {
          "id": "party",
          "label": "הצד האחראי",
          "type": "enum",
          "choices": {
            "owner": "בעלת המערכת",
            "partner": "החוקרת",
            "shared": "שני הצדדים"
          },
          "required": true
        },
        {
          "id": "description",
          "label": "תיאור ההתחייבות",
          "type": "text",
          "required": true,
          "category": "obligations"
        },
        {
          "id": "amount",
          "label": "סכום",
          "type": "money",
          "category": "financial"
        },
        {
          "id": "currency",
          "label": "מטבע",
          "type": "enum",
          "choices": {
            "ILS": "שקל",
            "USD": "דולר ארה״ב",
            "EUR": "אירו",
            "GBP": "ליש״ט"
          }
        },
        {
          "id": "dueDate",
          "label": "מועד ביצוע",
          "type": "date",
          "category": "deadline"
        },
        {
          "id": "completionEvidence",
          "label": "תיעוד השלמה",
          "type": "text"
        },
        {
          "id": "evidenceDocumentIds",
          "label": "מסמכי תיעוד",
          "type": "tags",
          "itemType": "id",
          "reference": "document"
        }
      ]
    },
    "decision": {
      "label": "החלטה",
      "fields": [
        {
          "id": "title",
          "label": "כותרת",
          "type": "text",
          "required": true,
          "maxLength": 240
        },
        {
          "id": "summary",
          "label": "תיאור ההחלטה",
          "type": "text",
          "required": true
        },
        {
          "id": "rationale",
          "label": "נימוקים",
          "type": "text",
          "required": true
        },
        {
          "id": "decisionDate",
          "label": "מועד ההחלטה",
          "type": "date",
          "required": true
        },
        {
          "id": "relatedRecordIds",
          "label": "רשומות קשורות",
          "type": "tags",
          "itemType": "id",
          "reference": "record"
        },
        {
          "id": "nextSteps",
          "label": "הצעדים הבאים",
          "type": "text",
          "category": "obligations"
        },
        {
          "id": "supportingDocumentIds",
          "label": "מסמכים תומכים",
          "type": "tags",
          "itemType": "id",
          "reference": "document"
        }
      ]
    }
  },
  "partner": [
    {
      "id": "fullName",
      "label": "שם מלא",
      "type": "text",
      "required": true
    },
    {
      "id": "email",
      "label": "דוא״ל",
      "type": "email",
      "required": true
    },
    {
      "id": "applicantType",
      "label": "סוג הפונה",
      "type": "enum",
      "choices": {
        "individual": "אדם פרטי",
        "institution": "מוסד"
      }
    },
    {
      "id": "institution",
      "label": "מוסד",
      "type": "text",
      "required": true,
      "requiredUnless": {
        "field": "applicantType",
        "equals": "individual"
      }
    },
    {
      "id": "department",
      "label": "מחלקה",
      "type": "text"
    },
    {
      "id": "position",
      "label": "תפקיד",
      "type": "text"
    },
    {
      "id": "phone",
      "label": "טלפון",
      "type": "text"
    },
    {
      "id": "profileNotes",
      "label": "פרטים מקצועיים",
      "type": "text"
    },
    {
      "id": "researchInterests",
      "label": "תחומי מחקר",
      "type": "tags"
    }
  ],
  "terms": [
    {
      "id": "recognition",
      "label": "הכרה מוסכמת",
      "type": "text"
    },
    {
      "id": "compensation",
      "label": "תמורה מוצעת לאישור",
      "type": "money",
      "category": "financial"
    },
    {
      "id": "currency",
      "label": "מטבע",
      "type": "enum",
      "choices": {
        "ILS": "שקל",
        "USD": "דולר ארה״ב",
        "EUR": "אירו",
        "GBP": "ליש״ט"
      }
    },
    {
      "id": "usage",
      "label": "שימוש מוסכם",
      "type": "text",
      "category": "access"
    },
    {
      "id": "ip",
      "label": "תנאי קניין רוחני מוצעים",
      "type": "text",
      "category": "IP"
    },
    {
      "id": "ownerObligations",
      "label": "התחייבויות מוצעות לבעלת המערכת",
      "type": "text",
      "category": "obligations"
    },
    {
      "id": "partnerObligations",
      "label": "התחייבויות מוצעות לחוקרת",
      "type": "text",
      "category": "obligations"
    },
    {
      "id": "deadline",
      "label": "מועד",
      "type": "date",
      "category": "deadline"
    },
    {
      "id": "supportingDocumentIds",
      "label": "מסמכים תומכים",
      "type": "tags",
      "itemType": "id",
      "reference": "document"
    }
  ],
  "transitions": {
    "application": [
      {
        "from": "draft",
        "to": "submitted",
        "action": "recordSubmit",
        "authority": "author"
      },
      {
        "from": "changes_requested",
        "to": "submitted",
        "action": "recordSubmit",
        "authority": "author"
      },
      {
        "from": "submitted",
        "to": "under_review",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "changes_requested",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "rejected",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "changes_requested",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "rejected",
        "action": "recordReview",
        "authority": "owner"
      }
    ],
    "analysis_request": [
      {
        "from": "draft",
        "to": "submitted",
        "action": "recordSubmit",
        "authority": "author"
      },
      {
        "from": "changes_requested",
        "to": "submitted",
        "action": "recordSubmit",
        "authority": "author"
      },
      {
        "from": "submitted",
        "to": "under_review",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "changes_requested",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "rejected",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "changes_requested",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "rejected",
        "action": "recordReview",
        "authority": "owner"
      }
    ],
    "contribution": [
      {
        "from": "draft",
        "to": "submitted",
        "action": "recordSubmit",
        "authority": "author"
      },
      {
        "from": "changes_requested",
        "to": "submitted",
        "action": "recordSubmit",
        "authority": "author"
      },
      {
        "from": "submitted",
        "to": "under_review",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "changes_requested",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "rejected",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "changes_requested",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "rejected",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "approved",
        "to": "completed",
        "action": "recordReview",
        "authority": "owner"
      }
    ],
    "budget": [
      {
        "from": "draft",
        "to": "submitted",
        "action": "recordSubmit",
        "authority": "author"
      },
      {
        "from": "changes_requested",
        "to": "submitted",
        "action": "recordSubmit",
        "authority": "author"
      },
      {
        "from": "submitted",
        "to": "under_review",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "changes_requested",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "rejected",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "changes_requested",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "rejected",
        "action": "recordReview",
        "authority": "owner"
      }
    ],
    "decision": [
      {
        "from": "draft",
        "to": "submitted",
        "action": "recordSubmit",
        "authority": "author"
      },
      {
        "from": "changes_requested",
        "to": "submitted",
        "action": "recordSubmit",
        "authority": "author"
      },
      {
        "from": "submitted",
        "to": "under_review",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "changes_requested",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "rejected",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "changes_requested",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "rejected",
        "action": "recordReview",
        "authority": "owner"
      }
    ],
    "finding": [
      {
        "from": "draft",
        "to": "owner_review",
        "action": "recordSubmit",
        "authority": "author"
      },
      {
        "from": "owner_review",
        "to": "draft",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "owner_review",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "approved",
        "to": "published",
        "action": "findingPublish",
        "authority": "owner"
      },
      {
        "from": "published",
        "to": "withdrawn",
        "action": "findingWithdraw",
        "authority": "owner"
      }
    ],
    "analysis_result": [
      {
        "from": "draft",
        "to": "owner_review",
        "action": "recordSubmit",
        "authority": "author"
      },
      {
        "from": "owner_review",
        "to": "draft",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "owner_review",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "approved",
        "to": "published",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "published",
        "to": "withdrawn",
        "action": "recordReview",
        "authority": "owner"
      }
    ],
    "agreement": [
      {
        "from": "draft",
        "to": "submitted",
        "action": "recordSubmit",
        "authority": "author"
      },
      {
        "from": "changes_requested",
        "to": "submitted",
        "action": "recordSubmit",
        "authority": "author"
      },
      {
        "from": "submitted",
        "to": "under_review",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "changes_requested",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "submitted",
        "to": "rejected",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "changes_requested",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "rejected",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "approved",
        "to": "signing",
        "action": "signingStart",
        "authority": "owner"
      },
      {
        "from": "signing",
        "to": "executed",
        "action": "signatureComplete",
        "authority": "internal"
      }
    ],
    "agreement_template": [
      {
        "from": "draft",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "approved",
        "to": "retired",
        "action": "recordReview",
        "authority": "owner"
      }
    ],
    "obligation": [
      {
        "from": "draft",
        "to": "under_review",
        "action": "recordSubmit",
        "authority": "owner"
      },
      {
        "from": "under_review",
        "to": "approved",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "approved",
        "to": "in_progress",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "approved",
        "to": "completed",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "approved",
        "to": "disputed",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "approved",
        "to": "cancelled",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "in_progress",
        "to": "completed",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "in_progress",
        "to": "disputed",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "in_progress",
        "to": "cancelled",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "disputed",
        "to": "completed",
        "action": "recordReview",
        "authority": "owner"
      },
      {
        "from": "disputed",
        "to": "cancelled",
        "action": "recordReview",
        "authority": "owner"
      }
    ]
  },
  "operations": {
    "workspaceBootstrap": {
      "request": {},
      "result": {
        "owner": "boolean",
        "partners": "PartnerSummary[]",
        "studies": "StudySummary[]",
        "capabilities": "string[]",
        "readiness": "Readiness"
      },
      "authority": "verified session"
    },
    "partnerSave": {
      "request": {
        "partnerId": "uuid?",
        "expectedRevision": "integer|null",
        "individualCode": "string? owner only",
        "profile": "PartnerData"
      },
      "result": {
        "partner": "Partner"
      },
      "authority": "owner or self; self identity is session-derived"
    },
    "partnerGet": {
      "request": {
        "partnerId": "uuid"
      },
      "result": {
        "partner": "Partner",
        "workspaces": "WorkspaceSummary[]"
      },
      "authority": "owner or self"
    },
    "workspaceList": {
      "request": {
        "studyId": "uuid?",
        "partnerId": "uuid?",
        "kind": "RecordKind?",
        "status": "RecordStatus?",
        "query": "string?",
        "cursor": "string?"
      },
      "result": {
        "workspaces": "WorkspaceSummary[]",
        "nextCursor": "string|null"
      },
      "authority": "owner overview or own authorized folders"
    },
    "recordGet": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid",
        "versionId": "uuid?"
      },
      "result": {
        "record": "Record",
        "version": "RecordVersion",
        "reviews": "Review[]? owner or author only",
        "comments": "FindingComment[]? exact authorized version",
        "approvals": "AgreementApproval[]? actual agreement party only",
        "signing": "SigningSession? actual agreement party only",
        "access": "EffectiveRecordAccess"
      },
      "authority": "owner, author or explicit authorized version viewer"
    },
    "recordSave": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid? new records omit",
        "kind": "RecordKind",
        "data": "TypedRecordData",
        "expectedRevision": "integer|null"
      },
      "result": {
        "record": "Record",
        "version": "RecordVersion"
      },
      "authority": "author or owner counterproposal on unexecuted records; new immutable draft invalidates approvals; owner-only templates/results/budgets/obligations/decisions"
    },
    "recordSubmit": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid",
        "versionId": "uuid",
        "expectedRevision": "integer"
      },
      "result": {
        "record": "Record",
        "version": "RecordVersion"
      },
      "authority": "author; obligations owner only"
    },
    "recordReview": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid",
        "versionId": "uuid",
        "expectedRevision": "integer",
        "decision": "target RecordStatus",
        "note": "string?",
        "approvedTerms": "ApprovedTerms? contribution only",
        "cancellationAgreementVersionId": "uuid? obligation cancellation only",
        "viewerPartnerIds": "uuid[]? analysis_result publication or approved contribution only",
        "downloadPartnerIds": "uuid[]? subset of explicit viewers"
      },
      "result": {
        "record": "Record",
        "review": "Review"
      },
      "authority": "owner"
    },
    "recordVersions": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid"
      },
      "result": {
        "versions": "RecordVersionSummary[]"
      },
      "authority": "owner or author; publication viewers see released version only"
    },
    "findingPublish": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid",
        "versionId": "uuid",
        "expectedRevision": "integer",
        "viewerPartnerIds": "uuid[]",
        "downloadPartnerIds": "uuid[]"
      },
      "result": {
        "record": "Record",
        "publication": "Publication"
      },
      "authority": "owner; exact approved version; privacy and consent review"
    },
    "findingWithdraw": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid",
        "versionId": "uuid",
        "expectedRevision": "integer",
        "reason": "string"
      },
      "result": {
        "record": "Record"
      },
      "authority": "owner"
    },
    "findingComment": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid",
        "versionId": "uuid",
        "text": "string"
      },
      "result": {
        "comment": "FindingComment"
      },
      "authority": "authorized published viewer with comment_on_findings"
    },
    "partnerInviteCreate": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "expiresAt": "ISO timestamp?",
        "preset": "AccessPreset",
        "permissions": "string[]?"
      },
      "result": {
        "invitation": "PartnerInvitation",
        "delivery": "DeliveryState"
      },
      "authority": "owner"
    },
    "partnerInviteGet": {
      "request": {
        "invite": "opaque token"
      },
      "result": {
        "invitation": "PartnerInvitationPreview"
      },
      "authority": "verified invited individual only"
    },
    "partnerInviteAccept": {
      "request": {
        "invite": "opaque token"
      },
      "result": {
        "partner": "Partner",
        "workspace": "WorkspaceSummary"
      },
      "authority": "verified invited individual only"
    },
    "partnerInviteRevoke": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "invitationId": "uuid",
        "expectedRevision": "integer"
      },
      "result": {
        "invitation": "PartnerInvitation"
      },
      "authority": "owner"
    },
    "agreementApprove": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid",
        "versionId": "uuid",
        "expectedRevision": "integer",
        "documentHash": "sha256",
        "ipExplanationVersionId": "uuid",
        "ipReadAcknowledged": "true"
      },
      "result": {
        "record": "Record",
        "approval": "AgreementApproval",
        "approvals": "AgreementApproval[]"
      },
      "authority": "actual owner or actual partner; same version/hash"
    },
    "agreementAmend": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid",
        "versionId": "uuid",
        "expectedRevision": "integer",
        "data": "AgreementData",
        "reason": "string"
      },
      "result": {
        "record": "Record",
        "version": "RecordVersion"
      },
      "authority": "actual owner or actual partner; new agreement record referencing executed source"
    },
    "signingStart": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid",
        "versionId": "uuid",
        "expectedRevision": "integer",
        "documentHash": "sha256",
        "consent": "true"
      },
      "result": {
        "signing": "SigningSession"
      },
      "authority": "owner; both exact-version approvals and operational provider"
    },
    "signingView": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid",
        "signingId": "uuid"
      },
      "result": {
        "signing": "SigningSession"
      },
      "authority": "actual owner or actual agreement partner"
    },
    "signingRefresh": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid",
        "signingId": "uuid",
        "expectedRevision": "integer"
      },
      "result": {
        "record": "Record",
        "signing": "SigningSession"
      },
      "authority": "actual owner or actual agreement partner; server verifies provider state"
    },
    "workspaceDocumentPut": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid?",
        "filename": "string",
        "mediaType": "allowlisted MIME",
        "contentBase64": "bounded base64"
      },
      "result": {
        "document": "PrivateDocumentMetadata"
      },
      "authority": "owner or actual folder author; private server encrypted storage"
    },
    "workspaceDocumentGet": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "documentId": "uuid",
        "download": "boolean?"
      },
      "result": {
        "document": "PrivateDocumentMetadata",
        "contentBase64": "base64"
      },
      "authority": "current folder/record/version authorization; separate release/download rights"
    },
    "workspaceExport": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid",
        "versionId": "uuid",
        "format": "text|json|html|docx"
      },
      "result": {
        "filename": "string",
        "mediaType": "MIME",
        "contentBase64": "base64",
        "versionId": "uuid",
        "documentHash": "sha256"
      },
      "authority": "current exact-version read AND applicable export/download rights; PDF via authorized HTML and native browser print"
    },
    "workspaceImpact": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "recordId": "uuid",
        "fromVersionId": "uuid",
        "toVersionId": "uuid",
        "includeAI": "boolean?"
      },
      "result": {
        "changes": "FieldChange[]",
        "approvalsInvalidated": "boolean",
        "binding": "false",
        "ai": "ImpactAIState"
      },
      "authority": "owner or actual record author"
    },
    "workspaceAnalysis": {
      "request": {
        "studyId": "uuid",
        "partnerId": "uuid",
        "requestRecordId": "uuid",
        "sourceSnapshotId": "uuid? omit to create consent-bound snapshot",
        "operation": "AnalysisOperation"
      },
      "result": {
        "operation": "AnalysisOperation",
        "sourceSnapshotId": "uuid",
        "summary": "ApprovedAnalysisProjection",
        "provenance": "AnalysisProvenance",
        "record": "Record draft analysis_result",
        "version": "RecordVersion"
      },
      "authority": "owner only; approved request and fixed allowlisted parameters; requestId required"
    }
  },
  "reads": [
    "workspaceBootstrap",
    "partnerGet",
    "workspaceList",
    "recordGet",
    "recordVersions",
    "partnerInviteGet",
    "signingView",
    "workspaceDocumentGet",
    "workspaceExport",
    "workspaceImpact"
  ],
  "sections": [
    {
      "id": "parties",
      "label": "פרטי הצדדים"
    },
    {
      "id": "study",
      "label": "המחקר ומטרותיו"
    },
    {
      "id": "tools",
      "label": "כלים, שאלונים והרשאות"
    },
    {
      "id": "contributions",
      "label": "תרומות הצדדים"
    },
    {
      "id": "sharedExpenses",
      "label": "הוצאות משותפות"
    },
    {
      "id": "professionalFees",
      "label": "שכר ושירותים מקצועיים"
    },
    {
      "id": "development",
      "label": "פיתוח ותמיכה"
    },
    {
      "id": "mutualIP",
      "label": "קניין רוחני הדדי"
    },
    {
      "id": "privacyEthics",
      "label": "פרטיות ואתיקה"
    },
    {
      "id": "durationTermination",
      "label": "תקופה וסיום"
    },
    {
      "id": "annexes",
      "label": "נספחים וסעיפים נוספים"
    },
    {
      "id": "reviewSigning",
      "label": "עיון, אישור וחתימה"
    }
  ],
  "presets": {
    "approved_findings": [
      "view_study",
      "view_approved_findings"
    ],
    "collaborative_analysis": [
      "view_study",
      "view_approved_findings",
      "propose_analysis",
      "view_analysis_results",
      "comment_on_findings"
    ]
  },
  "guidedAgreement": {
    "version": "4",
    "annexes": [
      {
        "id": "A",
        "label": "תוכנית המחקר, מועדים ואחריות",
        "section": "study",
        "statusField": "annexAStatus",
        "reasonField": "annexAReason",
        "rowsField": "annexA"
      },
      {
        "id": "B",
        "label": "כלים והרשאות",
        "section": "tools",
        "statusField": "annexBStatus",
        "reasonField": "annexBReason",
        "rowsField": "annexB"
      },
      {
        "id": "C",
        "label": "תקציב, הוצאות ושכר",
        "section": "sharedExpenses",
        "statusField": "annexCStatus",
        "reasonField": "annexCReason",
        "rowsField": "annexC"
      },
      {
        "id": "D",
        "label": "תרומות ופיתוח",
        "section": "contributions",
        "statusField": "annexDStatus",
        "reasonField": "annexDReason",
        "rowsField": "annexD"
      },
      {
        "id": "E",
        "label": "פרטיות, הסכמות ואתיקה",
        "section": "privacyEthics",
        "statusField": "annexEStatus",
        "reasonField": "annexEReason",
        "rowsField": "annexE"
      },
      {
        "id": "F",
        "label": "תוצרים, זכויות ופרסום",
        "section": "mutualIP",
        "statusField": "annexFStatus",
        "reasonField": "annexFReason",
        "rowsField": "annexF"
      }
    ]
  }
}
$json$::jsonb $contract$;

CREATE OR REPLACE FUNCTION research_private.partnership_fields(fields jsonb,d jsonb,sid uuid,pid uuid,complete boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE def jsonb; val jsonb; cell jsonb; k text; str text; typ text; BEGIN
 IF pg_catalog.jsonb_typeof(d) IS DISTINCT FROM 'object' THEN PERFORM research_private.fail('invalid'); END IF;
 FOR k IN SELECT pg_catalog.jsonb_object_keys(d) LOOP IF NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(fields) f WHERE f->>'id'=k) THEN PERFORM research_private.fail('invalid'); END IF; END LOOP;
 FOR def IN SELECT * FROM pg_catalog.jsonb_array_elements(fields) LOOP
  val:=d->(def->>'id');typ:=def->>'type';
  IF complete AND def->>'required'='true' AND (NOT(def ? 'requiredWhen') OR COALESCE(d->>(def#>>'{requiredWhen,field}')=def#>>'{requiredWhen,equals}',false)) AND NOT COALESCE(d->>(def#>>'{requiredUnless,field}') = def#>>'{requiredUnless,equals}',false) AND (val IS NULL OR val='null'::jsonb OR val='[]'::jsonb OR (pg_catalog.jsonb_typeof(val)='string' AND pg_catalog.btrim(val#>>'{}')='')) THEN PERFORM research_private.fail('invalid'); END IF;
  IF val IS NULL THEN CONTINUE; END IF;
  str:=val#>>'{}';
  IF val='""'::jsonb AND typ IN ('text','email','date','id','enum','money') THEN CONTINUE; END IF;
  IF typ IN ('text','email','date','id','enum','money') AND pg_catalog.jsonb_typeof(val)<>'string' THEN PERFORM research_private.fail('invalid'); END IF;
  IF typ='text' THEN IF pg_catalog.length(str)>COALESCE((def->>'maxLength')::integer,20000) THEN PERFORM research_private.fail('invalid'); END IF;
  ELSIF typ='email' THEN IF pg_catalog.length(str)>254 OR str!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN PERFORM research_private.fail('invalid'); END IF;
  ELSIF typ='date' THEN IF str!~'^\d{4}-\d{2}-\d{2}$' OR pg_catalog.to_char(str::date,'YYYY-MM-DD')<>str THEN PERFORM research_private.fail('invalid'); END IF;
  ELSIF typ='id' THEN IF str!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN PERFORM research_private.fail('invalid'); END IF;
  ELSIF typ='money' THEN IF str!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$' THEN PERFORM research_private.fail('invalid'); END IF;
  ELSIF typ='integer' THEN IF pg_catalog.jsonb_typeof(val)<>'number' OR str!~'^[0-9]+$' OR str::numeric>9007199254740991 THEN PERFORM research_private.fail('invalid'); END IF;
  ELSIF typ='boolean' THEN IF pg_catalog.jsonb_typeof(val)<>'boolean' THEN PERFORM research_private.fail('invalid'); END IF;
  ELSIF typ='enum' THEN IF NOT (def->'choices' ? str) THEN PERFORM research_private.fail('invalid'); END IF;
  ELSIF typ IN ('tags','rows') THEN
   IF pg_catalog.jsonb_typeof(val)<>'array' OR pg_catalog.jsonb_array_length(val)>200 THEN PERFORM research_private.fail('invalid'); END IF;
   IF typ='tags' AND (SELECT pg_catalog.count(*)<>pg_catalog.count(DISTINCT x) FROM pg_catalog.jsonb_array_elements(val) x) THEN PERFORM research_private.fail('invalid'); END IF;
   FOR cell IN SELECT * FROM pg_catalog.jsonb_array_elements(val) LOOP
    IF typ='rows' THEN PERFORM research_private.partnership_fields(def->'fields',cell,sid,pid,complete);
    ELSE IF pg_catalog.jsonb_typeof(cell)<>'string' OR pg_catalog.btrim(cell#>>'{}')='' OR pg_catalog.length(cell#>>'{}')>500 OR (def ? 'choices' AND NOT(def->'choices' ? (cell#>>'{}'))) OR (def->>'itemType'='id' AND (cell#>>'{}')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') THEN PERFORM research_private.fail('invalid'); END IF;
     IF def ? 'reference' THEN PERFORM research_private.partnership_ref(sid,pid,def->>'reference',(cell#>>'{}')::uuid,complete); END IF;
    END IF;
   END LOOP;
  ELSE PERFORM research_private.fail('invalid'); END IF;
  IF typ='id' AND def ? 'reference' THEN PERFORM research_private.partnership_ref(sid,pid,def->>'reference',str::uuid,complete); END IF;
 END LOOP;
 IF (d->>'startDate'>d->>'endDate') OR (d->>'effectiveDate'>d->>'terminationDate') THEN PERFORM research_private.fail('invalid'); END IF;
END $f$;

COMMIT;
