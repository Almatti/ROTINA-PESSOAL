// ARQUIVO GERADO por scripts/gen-local-schema.mjs — não edite à mão.
/* eslint-disable */
export const LOCAL_SCHEMA = {
 "profiles": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": null
   },
   "full_name": {
    "type": "text",
    "default": null
   },
   "nickname": {
    "type": "text",
    "default": null
   },
   "avatar_url": {
    "type": "text",
    "default": null
   },
   "timezone": {
    "type": "text",
    "default": {
     "value": "America/Sao_Paulo"
    }
   },
   "currency": {
    "type": "text",
    "default": {
     "value": "BRL"
    }
   },
   "locale": {
    "type": "text",
    "default": {
     "value": "pt-BR"
    }
   },
   "theme": {
    "type": "text",
    "default": {
     "value": "system"
    }
   },
   "accent": {
    "type": "text",
    "default": {
     "value": "orquidea"
    }
   },
   "onboarding_completed": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "goals": {
    "type": "text[]",
    "default": {
     "value": []
    }
   },
   "interests": {
    "type": "text[]",
    "default": {
     "value": []
    }
   },
   "wake_time": {
    "type": "time",
    "default": null
   },
   "bed_time": {
    "type": "time",
    "default": null
   },
   "work_start": {
    "type": "time",
    "default": null
   },
   "work_end": {
    "type": "time",
    "default": null
   },
   "sleep_goal_minutes": {
    "type": "integer",
    "default": {
     "value": 480
    }
   },
   "water_goal_ml": {
    "type": "integer",
    "default": {
     "value": 2000
    }
   },
   "monthly_income_goal": {
    "type": "numeric(14",
    "default": null
   },
   "monthly_savings_goal": {
    "type": "numeric(14",
    "default": null
   },
   "monthly_budget": {
    "type": "numeric(14",
    "default": null
   },
   "notification_prefs": {
    "type": "jsonb",
    "default": {
     "value": {
      "tarefas": true,
      "compromissos": true,
      "vencimentos": true,
      "habitos": true,
      "agua": false,
      "resumo_manha": true,
      "revisao_noite": false
     }
    }
   },
   "dashboard_widgets": {
    "type": "jsonb",
    "default": {
     "value": []
    }
   },
   "modules": {
    "type": "jsonb",
    "default": {
     "value": {
      "ciclo": false,
      "gamificacao": true,
      "treinos": true,
      "estudos": true,
      "trabalho": true,
      "casa": true
     }
    }
   },
   "avatar_config": {
    "type": "jsonb",
    "default": {
     "value": {
      "emoji": "🌸",
      "color": "#7451A6",
      "frame": "simples"
     }
    }
   },
   "privacy_accepted_at": {
    "type": "timestamptz",
    "default": null
   },
   "ai_consent_at": {
    "type": "timestamptz",
    "default": null
   },
   "cycle_consent_at": {
    "type": "timestamptz",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   },
   "updated_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "consents": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "kind": {
    "type": "text",
    "default": null
   },
   "granted": {
    "type": "boolean",
    "default": null
   },
   "policy_version": {
    "type": "text",
    "default": {
     "value": "2026-11"
    }
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "categories": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "scope": {
    "type": "text",
    "default": null
   },
   "name": {
    "type": "text",
    "default": null
   },
   "color": {
    "type": "text",
    "default": {
     "value": "#7451A6"
    }
   },
   "icon": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "user_id",
    "scope",
    "name"
   ],
   [
    "id",
    "user_id"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "projects": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "name": {
    "type": "text",
    "default": null
   },
   "description": {
    "type": "text",
    "default": null
   },
   "objective": {
    "type": "text",
    "default": null
   },
   "area": {
    "type": "text",
    "default": {
     "value": "trabalho"
    }
   },
   "client": {
    "type": "text",
    "default": null
   },
   "status": {
    "type": "text",
    "default": {
     "value": "em_andamento"
    }
   },
   "start_date": {
    "type": "date",
    "default": null
   },
   "due_date": {
    "type": "date",
    "default": null
   },
   "color": {
    "type": "text",
    "default": {
     "value": "#7451A6"
    }
   },
   "links": {
    "type": "jsonb",
    "default": {
     "value": []
    }
   },
   "notes": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   },
   "updated_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "project_stages": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "project_id": {
    "type": "uuid",
    "default": null
   },
   "title": {
    "type": "text",
    "default": null
   },
   "due_date": {
    "type": "date",
    "default": null
   },
   "done": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "position": {
    "type": "integer",
    "default": {
     "value": 0
    }
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [
   {
    "parent": "projects",
    "column": "project_id"
   }
  ],
  "setNull": []
 },
 "tasks": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "title": {
    "type": "text",
    "default": null
   },
   "description": {
    "type": "text",
    "default": null
   },
   "notes": {
    "type": "text",
    "default": null
   },
   "category_id": {
    "type": "uuid",
    "default": null
   },
   "area": {
    "type": "text",
    "default": {
     "value": "pessoal"
    }
   },
   "project_id": {
    "type": "uuid",
    "default": null
   },
   "due_date": {
    "type": "date",
    "default": null
   },
   "due_time": {
    "type": "time",
    "default": null
   },
   "deadline": {
    "type": "date",
    "default": null
   },
   "priority": {
    "type": "text",
    "default": {
     "value": "media"
    }
   },
   "status": {
    "type": "text",
    "default": {
     "value": "pendente"
    }
   },
   "recurrence": {
    "type": "jsonb",
    "default": null
   },
   "recurrence_parent_id": {
    "type": "uuid",
    "default": null
   },
   "reminder_minutes": {
    "type": "integer",
    "default": null
   },
   "estimated_minutes": {
    "type": "integer",
    "default": null
   },
   "tags": {
    "type": "text[]",
    "default": {
     "value": []
    }
   },
   "is_starred": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "position": {
    "type": "integer",
    "default": {
     "value": 0
    }
   },
   "completed_at": {
    "type": "timestamptz",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   },
   "updated_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "recurrence_parent_id",
    "due_date"
   ]
  ],
  "cascade": [],
  "setNull": [
   {
    "parent": "categories",
    "column": "category_id"
   },
   {
    "parent": "projects",
    "column": "project_id"
   },
   {
    "parent": "tasks",
    "column": "recurrence_parent_id"
   }
  ]
 },
 "subtasks": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "task_id": {
    "type": "uuid",
    "default": null
   },
   "title": {
    "type": "text",
    "default": null
   },
   "done": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "position": {
    "type": "integer",
    "default": {
     "value": 0
    }
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [
   {
    "parent": "tasks",
    "column": "task_id"
   }
  ],
  "setNull": []
 },
 "events": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "title": {
    "type": "text",
    "default": null
   },
   "description": {
    "type": "text",
    "default": null
   },
   "location": {
    "type": "text",
    "default": null
   },
   "category_id": {
    "type": "uuid",
    "default": null
   },
   "area": {
    "type": "text",
    "default": {
     "value": "pessoal"
    }
   },
   "project_id": {
    "type": "uuid",
    "default": null
   },
   "starts_at": {
    "type": "timestamptz",
    "default": null
   },
   "ends_at": {
    "type": "timestamptz",
    "default": null
   },
   "all_day": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "recurrence": {
    "type": "jsonb",
    "default": null
   },
   "reminder_minutes": {
    "type": "integer",
    "default": null
   },
   "color": {
    "type": "text",
    "default": null
   },
   "source": {
    "type": "text",
    "default": {
     "value": "vilma"
    }
   },
   "google_event_id": {
    "type": "text",
    "default": null
   },
   "google_etag": {
    "type": "text",
    "default": null
   },
   "google_updated_at": {
    "type": "timestamptz",
    "default": null
   },
   "local_updated_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   },
   "deleted_at": {
    "type": "timestamptz",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   },
   "updated_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "user_id",
    "google_event_id"
   ]
  ],
  "cascade": [],
  "setNull": [
   {
    "parent": "categories",
    "column": "category_id"
   },
   {
    "parent": "projects",
    "column": "project_id"
   }
  ]
 },
 "habits": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "name": {
    "type": "text",
    "default": null
   },
   "emoji": {
    "type": "text",
    "default": {
     "value": "✨"
    }
   },
   "color": {
    "type": "text",
    "default": {
     "value": "#7451A6"
    }
   },
   "kind": {
    "type": "text",
    "default": {
     "value": "construir"
    }
   },
   "frequency": {
    "type": "jsonb",
    "default": {
     "value": {
      "type": "daily"
     }
    }
   },
   "target_value": {
    "type": "numeric(10",
    "default": {
     "value": 1
    }
   },
   "unit": {
    "type": "text",
    "default": {
     "value": "vez"
    }
   },
   "step_value": {
    "type": "numeric(10",
    "default": {
     "value": 1
    }
   },
   "time_of_day": {
    "type": "time",
    "default": null
   },
   "period": {
    "type": "text",
    "default": {
     "value": "qualquer"
    }
   },
   "reminder": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "started_on": {
    "type": "date",
    "default": {
     "fn": "today"
    }
   },
   "money_per_day": {
    "type": "numeric(10",
    "default": null
   },
   "archived": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "position": {
    "type": "integer",
    "default": {
     "value": 0
    }
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   },
   "updated_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "habit_logs": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "habit_id": {
    "type": "uuid",
    "default": null
   },
   "log_date": {
    "type": "date",
    "default": null
   },
   "value": {
    "type": "numeric(10",
    "default": {
     "value": 0
    }
   },
   "completed": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "note": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "habit_id",
    "log_date"
   ]
  ],
  "cascade": [
   {
    "parent": "habits",
    "column": "habit_id"
   }
  ],
  "setNull": []
 },
 "financial_accounts": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "name": {
    "type": "text",
    "default": null
   },
   "type": {
    "type": "text",
    "default": {
     "value": "corrente"
    }
   },
   "initial_balance": {
    "type": "numeric(14",
    "default": {
     "value": 0
    }
   },
   "color": {
    "type": "text",
    "default": {
     "value": "#7451A6"
    }
   },
   "include_in_total": {
    "type": "boolean",
    "default": {
     "value": true
    }
   },
   "archived": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "credit_cards": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "name": {
    "type": "text",
    "default": null
   },
   "brand": {
    "type": "text",
    "default": null
   },
   "limit_amount": {
    "type": "numeric(14",
    "default": {
     "value": 0
    }
   },
   "closing_day": {
    "type": "smallint",
    "default": null
   },
   "due_day": {
    "type": "smallint",
    "default": null
   },
   "color": {
    "type": "text",
    "default": {
     "value": "#312A44"
    }
   },
   "payment_account_id": {
    "type": "uuid",
    "default": null
   },
   "archived": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": [
   {
    "parent": "financial_accounts",
    "column": "payment_account_id"
   }
  ]
 },
 "recurring_transactions": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "type": {
    "type": "text",
    "default": null
   },
   "description": {
    "type": "text",
    "default": null
   },
   "amount": {
    "type": "numeric(14",
    "default": null
   },
   "category_id": {
    "type": "uuid",
    "default": null
   },
   "account_id": {
    "type": "uuid",
    "default": null
   },
   "card_id": {
    "type": "uuid",
    "default": null
   },
   "frequency": {
    "type": "text",
    "default": {
     "value": "mensal"
    }
   },
   "day_of_month": {
    "type": "smallint",
    "default": null
   },
   "start_date": {
    "type": "date",
    "default": {
     "fn": "today"
    }
   },
   "end_date": {
    "type": "date",
    "default": null
   },
   "is_subscription": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "is_fixed": {
    "type": "boolean",
    "default": {
     "value": true
    }
   },
   "active": {
    "type": "boolean",
    "default": {
     "value": true
    }
   },
   "last_generated_on": {
    "type": "date",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": [
   {
    "parent": "categories",
    "column": "category_id"
   },
   {
    "parent": "financial_accounts",
    "column": "account_id"
   },
   {
    "parent": "credit_cards",
    "column": "card_id"
   }
  ]
 },
 "transactions": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "type": {
    "type": "text",
    "default": null
   },
   "amount": {
    "type": "numeric(14",
    "default": null
   },
   "description": {
    "type": "text",
    "default": null
   },
   "category_id": {
    "type": "uuid",
    "default": null
   },
   "account_id": {
    "type": "uuid",
    "default": null
   },
   "to_account_id": {
    "type": "uuid",
    "default": null
   },
   "card_id": {
    "type": "uuid",
    "default": null
   },
   "invoice_month": {
    "type": "date",
    "default": null
   },
   "occurred_on": {
    "type": "date",
    "default": {
     "fn": "today"
    }
   },
   "due_date": {
    "type": "date",
    "default": null
   },
   "status": {
    "type": "text",
    "default": {
     "value": "pago"
    }
   },
   "is_fixed": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "recurring_id": {
    "type": "uuid",
    "default": null
   },
   "installment_group": {
    "type": "uuid",
    "default": null
   },
   "installment_number": {
    "type": "smallint",
    "default": null
   },
   "installment_total": {
    "type": "smallint",
    "default": null
   },
   "notes": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   },
   "updated_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "recurring_id",
    "occurred_on"
   ]
  ],
  "cascade": [],
  "setNull": [
   {
    "parent": "categories",
    "column": "category_id"
   },
   {
    "parent": "financial_accounts",
    "column": "account_id"
   },
   {
    "parent": "financial_accounts",
    "column": "to_account_id"
   },
   {
    "parent": "credit_cards",
    "column": "card_id"
   },
   {
    "parent": "recurring_transactions",
    "column": "recurring_id"
   }
  ]
 },
 "invoices": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "card_id": {
    "type": "uuid",
    "default": null
   },
   "reference_month": {
    "type": "date",
    "default": null
   },
   "status": {
    "type": "text",
    "default": {
     "value": "aberta"
    }
   },
   "paid_transaction_id": {
    "type": "uuid",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "card_id",
    "reference_month"
   ]
  ],
  "cascade": [
   {
    "parent": "credit_cards",
    "column": "card_id"
   }
  ],
  "setNull": [
   {
    "parent": "transactions",
    "column": "paid_transaction_id"
   }
  ]
 },
 "budgets": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "month": {
    "type": "date",
    "default": null
   },
   "category_id": {
    "type": "uuid",
    "default": null
   },
   "limit_amount": {
    "type": "numeric(14",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [
   {
    "parent": "categories",
    "column": "category_id"
   }
  ],
  "setNull": []
 },
 "goals": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "title": {
    "type": "text",
    "default": null
   },
   "description": {
    "type": "text",
    "default": null
   },
   "horizon": {
    "type": "text",
    "default": {
     "value": "anual"
    }
   },
   "area": {
    "type": "text",
    "default": {
     "value": "pessoal"
    }
   },
   "target_value": {
    "type": "numeric(14",
    "default": null
   },
   "current_value": {
    "type": "numeric(14",
    "default": {
     "value": 0
    }
   },
   "unit": {
    "type": "text",
    "default": null
   },
   "due_date": {
    "type": "date",
    "default": null
   },
   "status": {
    "type": "text",
    "default": {
     "value": "ativa"
    }
   },
   "image_url": {
    "type": "text",
    "default": null
   },
   "linked_account_id": {
    "type": "uuid",
    "default": null
   },
   "last_reviewed_at": {
    "type": "timestamptz",
    "default": null
   },
   "completed_at": {
    "type": "timestamptz",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   },
   "updated_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": [
   {
    "parent": "financial_accounts",
    "column": "linked_account_id"
   }
  ]
 },
 "goal_steps": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "goal_id": {
    "type": "uuid",
    "default": null
   },
   "title": {
    "type": "text",
    "default": null
   },
   "due_date": {
    "type": "date",
    "default": null
   },
   "done": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "position": {
    "type": "integer",
    "default": {
     "value": 0
    }
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [
   {
    "parent": "goals",
    "column": "goal_id"
   }
  ],
  "setNull": []
 },
 "sleep_logs": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "sleep_date": {
    "type": "date",
    "default": null
   },
   "bed_at": {
    "type": "timestamptz",
    "default": null
   },
   "wake_at": {
    "type": "timestamptz",
    "default": null
   },
   "duration_minutes": {
    "type": "integer",
    "default": null
   },
   "quality": {
    "type": "smallint",
    "default": null
   },
   "notes": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "user_id",
    "sleep_date"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "mood_logs": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "log_date": {
    "type": "date",
    "default": null
   },
   "mood": {
    "type": "smallint",
    "default": null
   },
   "emoji": {
    "type": "text",
    "default": null
   },
   "intensity": {
    "type": "smallint",
    "default": null
   },
   "energy": {
    "type": "smallint",
    "default": null
   },
   "feelings": {
    "type": "text[]",
    "default": {
     "value": []
    }
   },
   "journal": {
    "type": "text",
    "default": null
   },
   "gratitude": {
    "type": "text",
    "default": null
   },
   "highlights": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   },
   "updated_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "user_id",
    "log_date"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "cycle_periods": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "start_date": {
    "type": "date",
    "default": null
   },
   "end_date": {
    "type": "date",
    "default": null
   },
   "flow": {
    "type": "text",
    "default": null
   },
   "notes": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "user_id",
    "start_date"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "cycle_symptoms": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "log_date": {
    "type": "date",
    "default": null
   },
   "symptoms": {
    "type": "text[]",
    "default": {
     "value": []
    }
   },
   "flow": {
    "type": "text",
    "default": null
   },
   "notes": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "user_id",
    "log_date"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "water_logs": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "log_date": {
    "type": "date",
    "default": {
     "fn": "today"
    }
   },
   "logged_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   },
   "amount_ml": {
    "type": "integer",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "workout_plans": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "name": {
    "type": "text",
    "default": null
   },
   "weekdays": {
    "type": "smallint[]",
    "default": {
     "value": []
    }
   },
   "goal": {
    "type": "text",
    "default": null
   },
   "notes": {
    "type": "text",
    "default": null
   },
   "active": {
    "type": "boolean",
    "default": {
     "value": true
    }
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "workout_exercises": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "plan_id": {
    "type": "uuid",
    "default": null
   },
   "name": {
    "type": "text",
    "default": null
   },
   "sets": {
    "type": "smallint",
    "default": {
     "value": 3
    }
   },
   "reps": {
    "type": "text",
    "default": {
     "value": "12"
    }
   },
   "load_kg": {
    "type": "numeric(6",
    "default": null
   },
   "rest_seconds": {
    "type": "integer",
    "default": {
     "value": 60
    }
   },
   "position": {
    "type": "integer",
    "default": {
     "value": 0
    }
   },
   "notes": {
    "type": "text",
    "default": null
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [
   {
    "parent": "workout_plans",
    "column": "plan_id"
   }
  ],
  "setNull": []
 },
 "workout_sessions": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "plan_id": {
    "type": "uuid",
    "default": null
   },
   "activity": {
    "type": "text",
    "default": {
     "value": "musculacao"
    }
   },
   "performed_on": {
    "type": "date",
    "default": {
     "fn": "today"
    }
   },
   "duration_minutes": {
    "type": "integer",
    "default": null
   },
   "distance_km": {
    "type": "numeric(6",
    "default": null
   },
   "effort": {
    "type": "smallint",
    "default": null
   },
   "notes": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": [
   {
    "parent": "workout_plans",
    "column": "plan_id"
   }
  ]
 },
 "workout_sets": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "session_id": {
    "type": "uuid",
    "default": null
   },
   "exercise_id": {
    "type": "uuid",
    "default": null
   },
   "exercise_name": {
    "type": "text",
    "default": null
   },
   "set_number": {
    "type": "smallint",
    "default": null
   },
   "reps": {
    "type": "smallint",
    "default": null
   },
   "load_kg": {
    "type": "numeric(6",
    "default": null
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [
   {
    "parent": "workout_sessions",
    "column": "session_id"
   }
  ],
  "setNull": [
   {
    "parent": "workout_exercises",
    "column": "exercise_id"
   }
  ]
 },
 "time_entries": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "project_id": {
    "type": "uuid",
    "default": null
   },
   "task_id": {
    "type": "uuid",
    "default": null
   },
   "worked_on": {
    "type": "date",
    "default": {
     "fn": "today"
    }
   },
   "duration_minutes": {
    "type": "integer",
    "default": null
   },
   "description": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [
   {
    "parent": "projects",
    "column": "project_id"
   }
  ],
  "setNull": [
   {
    "parent": "tasks",
    "column": "task_id"
   }
  ]
 },
 "courses": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "name": {
    "type": "text",
    "default": null
   },
   "kind": {
    "type": "text",
    "default": {
     "value": "curso"
    }
   },
   "institution": {
    "type": "text",
    "default": null
   },
   "color": {
    "type": "text",
    "default": {
     "value": "#88708E"
    }
   },
   "weekly_goal_minutes": {
    "type": "integer",
    "default": null
   },
   "total_lessons": {
    "type": "integer",
    "default": null
   },
   "lessons_done": {
    "type": "integer",
    "default": {
     "value": 0
    }
   },
   "links": {
    "type": "jsonb",
    "default": {
     "value": []
    }
   },
   "status": {
    "type": "text",
    "default": {
     "value": "em_andamento"
    }
   },
   "notes": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "study_sessions": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "course_id": {
    "type": "uuid",
    "default": null
   },
   "studied_on": {
    "type": "date",
    "default": {
     "fn": "today"
    }
   },
   "duration_minutes": {
    "type": "integer",
    "default": null
   },
   "topic": {
    "type": "text",
    "default": null
   },
   "notes": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [
   {
    "parent": "courses",
    "column": "course_id"
   }
  ],
  "setNull": []
 },
 "assessments": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "course_id": {
    "type": "uuid",
    "default": null
   },
   "type": {
    "type": "text",
    "default": null
   },
   "title": {
    "type": "text",
    "default": null
   },
   "due_date": {
    "type": "date",
    "default": null
   },
   "grade": {
    "type": "numeric(6",
    "default": null
   },
   "max_grade": {
    "type": "numeric(6",
    "default": null
   },
   "weight": {
    "type": "numeric(5",
    "default": null
   },
   "done": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "notes": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [
   {
    "parent": "courses",
    "column": "course_id"
   }
  ],
  "setNull": []
 },
 "rooms": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "name": {
    "type": "text",
    "default": null
   },
   "icon": {
    "type": "text",
    "default": {
     "value": "🏠"
    }
   },
   "color": {
    "type": "text",
    "default": {
     "value": "#DAD0E5"
    }
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "chores": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "room_id": {
    "type": "uuid",
    "default": null
   },
   "title": {
    "type": "text",
    "default": null
   },
   "frequency": {
    "type": "text",
    "default": {
     "value": "semanal"
    }
   },
   "last_done_on": {
    "type": "date",
    "default": null
   },
   "next_due_on": {
    "type": "date",
    "default": null
   },
   "notes": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": [
   {
    "parent": "rooms",
    "column": "room_id"
   }
  ]
 },
 "shopping_lists": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "name": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "shopping_items": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "list_id": {
    "type": "uuid",
    "default": null
   },
   "name": {
    "type": "text",
    "default": null
   },
   "quantity": {
    "type": "numeric(10",
    "default": {
     "value": 1
    }
   },
   "unit": {
    "type": "text",
    "default": null
   },
   "section": {
    "type": "text",
    "default": null
   },
   "price_estimate": {
    "type": "numeric(14",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [
   {
    "parent": "shopping_lists",
    "column": "list_id"
   }
  ],
  "setNull": []
 },
 "household_products": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "room_id": {
    "type": "uuid",
    "default": null
   },
   "name": {
    "type": "text",
    "default": null
   },
   "quantity": {
    "type": "numeric(10",
    "default": {
     "value": 0
    }
   },
   "min_quantity": {
    "type": "numeric(10",
    "default": {
     "value": 0
    }
   },
   "unit": {
    "type": "text",
    "default": null
   },
   "expires_on": {
    "type": "date",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": [
   {
    "parent": "rooms",
    "column": "room_id"
   }
  ]
 },
 "meals": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "meal_date": {
    "type": "date",
    "default": null
   },
   "meal_type": {
    "type": "text",
    "default": null
   },
   "description": {
    "type": "text",
    "default": null
   },
   "notes": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "user_id",
    "meal_date",
    "meal_type"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "maintenance_items": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "room_id": {
    "type": "uuid",
    "default": null
   },
   "title": {
    "type": "text",
    "default": null
   },
   "last_done_on": {
    "type": "date",
    "default": null
   },
   "next_due_on": {
    "type": "date",
    "default": null
   },
   "cost": {
    "type": "numeric(14",
    "default": null
   },
   "provider": {
    "type": "text",
    "default": null
   },
   "notes": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": [
   {
    "parent": "rooms",
    "column": "room_id"
   }
  ]
 },
 "note_folders": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "name": {
    "type": "text",
    "default": null
   },
   "color": {
    "type": "text",
    "default": {
     "value": "#BAAAC8"
    }
   },
   "parent_id": {
    "type": "uuid",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [
   {
    "parent": "note_folders",
    "column": "parent_id"
   }
  ],
  "setNull": []
 },
 "notes": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "title": {
    "type": "text",
    "default": {
     "value": ""
    }
   },
   "content": {
    "type": "text",
    "default": {
     "value": ""
    }
   },
   "kind": {
    "type": "text",
    "default": {
     "value": "nota"
    }
   },
   "folder_id": {
    "type": "uuid",
    "default": null
   },
   "category_id": {
    "type": "uuid",
    "default": null
   },
   "tags": {
    "type": "text[]",
    "default": {
     "value": []
    }
   },
   "links": {
    "type": "jsonb",
    "default": {
     "value": []
    }
   },
   "is_favorite": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "is_pinned": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "archived": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "task_id": {
    "type": "uuid",
    "default": null
   },
   "project_id": {
    "type": "uuid",
    "default": null
   },
   "event_id": {
    "type": "uuid",
    "default": null
   },
   "color": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   },
   "updated_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": [
   {
    "parent": "note_folders",
    "column": "folder_id"
   },
   {
    "parent": "categories",
    "column": "category_id"
   },
   {
    "parent": "tasks",
    "column": "task_id"
   },
   {
    "parent": "projects",
    "column": "project_id"
   },
   {
    "parent": "events",
    "column": "event_id"
   }
  ]
 },
 "note_attachments": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "note_id": {
    "type": "uuid",
    "default": null
   },
   "storage_path": {
    "type": "text",
    "default": null
   },
   "file_name": {
    "type": "text",
    "default": null
   },
   "mime_type": {
    "type": "text",
    "default": null
   },
   "size_bytes": {
    "type": "integer",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [
   {
    "parent": "notes",
    "column": "note_id"
   }
  ],
  "setNull": []
 },
 "focus_sessions": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "task_id": {
    "type": "uuid",
    "default": null
   },
   "mode": {
    "type": "text",
    "default": {
     "value": "foco"
    }
   },
   "planned_minutes": {
    "type": "integer",
    "default": null
   },
   "actual_minutes": {
    "type": "integer",
    "default": {
     "value": 0
    }
   },
   "started_at": {
    "type": "timestamptz",
    "default": null
   },
   "ended_at": {
    "type": "timestamptz",
    "default": null
   },
   "completed": {
    "type": "boolean",
    "default": {
     "value": false
    }
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": [
   {
    "parent": "tasks",
    "column": "task_id"
   }
  ]
 },
 "notifications": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "type": {
    "type": "text",
    "default": {
     "value": "info"
    }
   },
   "title": {
    "type": "text",
    "default": null
   },
   "body": {
    "type": "text",
    "default": null
   },
   "link": {
    "type": "text",
    "default": null
   },
   "dedupe_key": {
    "type": "text",
    "default": null
   },
   "read_at": {
    "type": "timestamptz",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "user_id",
    "dedupe_key"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "conversations": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "title": {
    "type": "text",
    "default": {
     "value": "Nova conversa"
    }
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   },
   "updated_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "messages": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "conversation_id": {
    "type": "uuid",
    "default": null
   },
   "role": {
    "type": "text",
    "default": null
   },
   "content": {
    "type": "text",
    "default": null
   },
   "actions": {
    "type": "jsonb",
    "default": {
     "value": []
    }
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [
   {
    "parent": "conversations",
    "column": "conversation_id"
   }
  ],
  "setNull": []
 },
 "pending_actions": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "conversation_id": {
    "type": "uuid",
    "default": null
   },
   "tool_name": {
    "type": "text",
    "default": null
   },
   "input": {
    "type": "jsonb",
    "default": null
   },
   "summary": {
    "type": "text",
    "default": null
   },
   "status": {
    "type": "text",
    "default": {
     "value": "pendente"
    }
   },
   "result": {
    "type": "jsonb",
    "default": null
   },
   "expires_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now+30m"
    }
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [
   {
    "parent": "conversations",
    "column": "conversation_id"
   }
  ],
  "setNull": []
 },
 "automations": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "key": {
    "type": "text",
    "default": null
   },
   "enabled": {
    "type": "boolean",
    "default": {
     "value": true
    }
   },
   "config": {
    "type": "jsonb",
    "default": {
     "value": {}
    }
   },
   "last_run_at": {
    "type": "timestamptz",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "user_id",
    "key"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "automation_runs": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "automation_key": {
    "type": "text",
    "default": null
   },
   "status": {
    "type": "text",
    "default": null
   },
   "details": {
    "type": "jsonb",
    "default": {
     "value": {}
    }
   },
   "ran_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "achievements": {
  "columns": {
   "key": {
    "type": "text",
    "default": null
   },
   "title": {
    "type": "text",
    "default": null
   },
   "description": {
    "type": "text",
    "default": null
   },
   "icon": {
    "type": "text",
    "default": null
   },
   "points": {
    "type": "integer",
    "default": {
     "value": 10
    }
   },
   "category": {
    "type": "text",
    "default": null
   }
  },
  "unique": [],
  "cascade": [],
  "setNull": []
 },
 "user_achievements": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "achievement_key": {
    "type": "text",
    "default": null
   },
   "unlocked_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "user_id",
    "achievement_key"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "point_events": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "source": {
    "type": "text",
    "default": null
   },
   "points": {
    "type": "integer",
    "default": null
   },
   "dedupe_key": {
    "type": "text",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "user_id",
    "dedupe_key"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "integrations": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "provider": {
    "type": "text",
    "default": null
   },
   "access_token_enc": {
    "type": "text",
    "default": null
   },
   "refresh_token_enc": {
    "type": "text",
    "default": null
   },
   "token_expires_at": {
    "type": "timestamptz",
    "default": null
   },
   "scope": {
    "type": "text",
    "default": null
   },
   "calendar_id": {
    "type": "text",
    "default": {
     "value": "primary"
    }
   },
   "sync_token": {
    "type": "text",
    "default": null
   },
   "status": {
    "type": "text",
    "default": {
     "value": "ativa"
    }
   },
   "last_error": {
    "type": "text",
    "default": null
   },
   "last_synced_at": {
    "type": "timestamptz",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "user_id",
    "provider"
   ]
  ],
  "cascade": [],
  "setNull": []
 },
 "rate_limits": {
  "columns": {
   "user_id": {
    "type": "uuid",
    "default": null
   },
   "bucket": {
    "type": "text",
    "default": null
   },
   "window_start": {
    "type": "timestamptz",
    "default": null
   },
   "count": {
    "type": "integer",
    "default": {
     "value": 0
    }
   }
  },
  "unique": [],
  "cascade": [],
  "setNull": []
 },
 "push_subscriptions": {
  "columns": {
   "id": {
    "type": "uuid",
    "default": {
     "fn": "uuid"
    }
   },
   "user_id": {
    "type": "uuid",
    "default": {
     "fn": "uid"
    }
   },
   "endpoint": {
    "type": "text",
    "default": null
   },
   "p256dh": {
    "type": "text",
    "default": null
   },
   "auth": {
    "type": "text",
    "default": null
   },
   "user_agent": {
    "type": "text",
    "default": null
   },
   "last_success_at": {
    "type": "timestamptz",
    "default": null
   },
   "created_at": {
    "type": "timestamptz",
    "default": {
     "fn": "now"
    }
   }
  },
  "unique": [
   [
    "id"
   ],
   [
    "endpoint"
   ]
  ],
  "cascade": [],
  "setNull": []
 }
} as const;
export const LOCAL_SEED = {"achievements":[{"key":"primeiro_passo","title":"Primeiro passo","description":"Concluiu o onboarding e configurou o perfil.","icon":"🌱","points":20,"category":"geral"},{"key":"primeira_tarefa","title":"Mão na massa","description":"Concluiu a primeira tarefa.","icon":"✅","points":10,"category":"tarefas"},{"key":"tarefas_10","title":"Ritmo constante","description":"Concluiu 10 tarefas.","icon":"📋","points":30,"category":"tarefas"},{"key":"tarefas_50","title":"Produtividade gentil","description":"Concluiu 50 tarefas.","icon":"🏅","points":80,"category":"tarefas"},{"key":"habito_7","title":"Uma semana inteira","description":"Manteve um hábito por 7 dias seguidos.","icon":"🔥","points":40,"category":"habitos"},{"key":"habito_30","title":"Hábito enraizado","description":"Manteve um hábito por 30 dias seguidos.","icon":"🌳","points":120,"category":"habitos"},{"key":"agua_meta","title":"Bem hidratada","description":"Bateu a meta de água em um dia.","icon":"💧","points":10,"category":"bem_estar"},{"key":"sono_meta_7","title":"Descanso em dia","description":"Atingiu a meta de sono em 7 noites.","icon":"🌙","points":50,"category":"bem_estar"},{"key":"journal_7","title":"Diário vivo","description":"Registrou o humor em 7 dias.","icon":"📔","points":30,"category":"bem_estar"},{"key":"foco_1","title":"Primeiro pomodoro","description":"Concluiu uma sessão de foco.","icon":"⏱️","points":10,"category":"foco"},{"key":"foco_25","title":"Mente focada","description":"Concluiu 25 sessões de foco.","icon":"🎯","points":80,"category":"foco"},{"key":"financas_primeiro","title":"Dinheiro no radar","description":"Registrou a primeira movimentação financeira.","icon":"💜","points":10,"category":"financas"},{"key":"orcamento","title":"Planejadora","description":"Criou um orçamento mensal.","icon":"🧾","points":20,"category":"financas"},{"key":"meta_concluida","title":"Sonho realizado","description":"Concluiu uma meta.","icon":"🏆","points":100,"category":"metas"},{"key":"treino_10","title":"Corpo em movimento","description":"Registrou 10 treinos.","icon":"💪","points":50,"category":"treinos"},{"key":"vilma_conversa","title":"Prazer, Vilma","description":"Conversou com a Vilma pela primeira vez.","icon":"✨","points":10,"category":"geral"}],"categories":[{"scope":"despesa","name":"Alimentação","color":"#E59A4F","icon":"🍽️"},{"scope":"despesa","name":"Mercado","color":"#F2B84B","icon":"🛒"},{"scope":"despesa","name":"Moradia","color":"#7451A6","icon":"🏠"},{"scope":"despesa","name":"Transporte","color":"#5B8DEF","icon":"🚗"},{"scope":"despesa","name":"Saúde","color":"#3FAE7A","icon":"🩺"},{"scope":"despesa","name":"Educação","color":"#4F7CAC","icon":"🎓"},{"scope":"despesa","name":"Lazer","color":"#D96BA0","icon":"🎉"},{"scope":"despesa","name":"Compras","color":"#B07CC6","icon":"🛍️"},{"scope":"despesa","name":"Assinaturas","color":"#88708E","icon":"📺"},{"scope":"despesa","name":"Investimentos","color":"#2E9C8F","icon":"📈"},{"scope":"despesa","name":"Outros","color":"#9A93A8","icon":"✨"},{"scope":"receita","name":"Salário","color":"#3FAE7A","icon":"💼"},{"scope":"receita","name":"Freelance","color":"#2E9C8F","icon":"🧑‍💻"},{"scope":"receita","name":"Rendimentos","color":"#5B8DEF","icon":"📈"},{"scope":"receita","name":"Outros","color":"#9A93A8","icon":"✨"},{"scope":"tarefa","name":"Pessoal","color":"#7451A6","icon":"🌸"},{"scope":"tarefa","name":"Trabalho","color":"#5B8DEF","icon":"💼"},{"scope":"tarefa","name":"Estudos","color":"#4F7CAC","icon":"📚"},{"scope":"tarefa","name":"Casa","color":"#E59A4F","icon":"🏡"},{"scope":"tarefa","name":"Saúde","color":"#3FAE7A","icon":"🩺"},{"scope":"evento","name":"Pessoal","color":"#7451A6","icon":"🌸"},{"scope":"evento","name":"Trabalho","color":"#5B8DEF","icon":"💼"},{"scope":"evento","name":"Saúde","color":"#3FAE7A","icon":"🩺"},{"scope":"evento","name":"Social","color":"#D96BA0","icon":"🥂"},{"scope":"evento","name":"Estudos","color":"#4F7CAC","icon":"📚"},{"scope":"nota","name":"Ideias","color":"#BAAAC8","icon":"💡"},{"scope":"nota","name":"Referências","color":"#88708E","icon":"🔖"}],"automations":["tarefas_recorrentes","contas_fixas","tarefas_atrasadas","compromissos_proximos","vencimentos","resumo_manha","revisao_noite","relatorio_mensal","planejamento_semanal","sugerir_reagendamento","progresso_diario","atualizar_metas"]} as const;
