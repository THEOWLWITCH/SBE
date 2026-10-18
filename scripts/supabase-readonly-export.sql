-- Owner-authorized emergency export through the existing SQL Editor session.
-- A single read-only statement: no functions, roles, files or records are created.
-- Download CSV without printing the payload: it contains confidential live data.
-- This is a logical data/catalog preservation format, not a pg_dump replacement.
-- Record inaccessible objects and provider-managed recovery dependencies explicitly.
WITH
namespaces AS MATERIALIZED (
  SELECT n.* FROM pg_namespace n
  WHERE n.nspname NOT IN ('pg_catalog','information_schema')
    AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'
),
relations AS MATERIALIZED (
  SELECT c.*, n.nspname FROM pg_class c JOIN namespaces n ON n.oid=c.relnamespace
  WHERE c.relkind IN ('r','p','v','m','S','f')
),
data_tables AS MATERIALIZED (
  SELECT r.nspname, r.relname,
    has_table_privilege(r.oid,'SELECT') AS readable,
    CASE WHEN has_table_privilege(r.oid,'SELECT') THEN
      convert_from(decode((xpath('/table/row/payload/text()',query_to_xml(
        format($export$SELECT encode(convert_to(coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb)::text,'UTF8'),'base64') AS payload FROM %I.%I AS t$export$, r.nspname,r.relname),true,false,'')))[1]::text,'base64'),'UTF8')::jsonb
    ELSE NULL END AS rows
  FROM relations r WHERE r.relkind IN ('r','p') AND NOT r.relispartition
),
sequence_states AS MATERIALIZED (
  SELECT r.nspname,r.relname,has_sequence_privilege(r.oid,'SELECT') AS readable,
    CASE WHEN has_sequence_privilege(r.oid,'SELECT') THEN
      convert_from(decode((xpath('/table/row/payload/text()',query_to_xml(
        format($export$SELECT encode(convert_to(jsonb_build_object('last_value',s.last_value,'log_cnt',s.log_cnt,'is_called',s.is_called)::text,'UTF8'),'base64') AS payload FROM %I.%I AS s$export$, r.nspname,r.relname),true,false,'')))[1]::text,'base64'),'UTF8')::jsonb
    ELSE NULL END AS state
  FROM relations r WHERE r.relkind='S'
),
snapshot AS (
  SELECT jsonb_build_object(
    'format','be-good-supabase-readonly-export','format_version',1,
    'project_ref','liausvuuqxeaildbbsjm','captured_at',current_timestamp,
    'database',current_database(),'server_version',current_setting('server_version'),
    'snapshot',pg_current_snapshot()::text,'statement_read_only',true,
    'recovery_limits',jsonb_build_array(
      'Not a pg_dump archive; provider-compatible restore has not been verified',
      'External Storage object bytes must be exported separately when present',
      'Role passwords, provider secrets and Vault encryption root are not included',
      'Foreign tables and materialized-view contents are not exported',
      'Live research/customer data must not be imported into a drill without separate approval'
    ),
    'schema',jsonb_build_object(
      'namespaces',(SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.nspname),'[]') FROM namespaces n),
      'relations',(SELECT coalesce(jsonb_agg((to_jsonb(r) || jsonb_build_object('owner',pg_get_userbyid(r.relowner),'partition_key',CASE WHEN r.relkind='p' THEN pg_get_partkeydef(r.oid) END,'partition_bound',CASE WHEN r.relispartition THEN pg_get_expr(r.relpartbound,r.oid) END)) ORDER BY r.nspname,r.relname),'[]') FROM relations r),
      'columns',(SELECT coalesce(jsonb_agg((to_jsonb(a) || jsonb_build_object('schema',r.nspname,'table',r.relname,'type',format_type(a.atttypid,a.atttypmod),'default',pg_get_expr(d.adbin,d.adrelid))) ORDER BY r.nspname,r.relname,a.attnum),'[]') FROM pg_attribute a JOIN relations r ON r.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped),
      'constraints',(SELECT coalesce(jsonb_agg((to_jsonb(c) || jsonb_build_object('schema',n.nspname,'relation',r.relname,'definition',pg_get_constraintdef(c.oid,true))) ORDER BY n.nspname,c.conname),'[]') FROM pg_constraint c JOIN namespaces n ON n.oid=c.connamespace LEFT JOIN relations r ON r.oid=c.conrelid),
      'indexes',(SELECT coalesce(jsonb_agg((to_jsonb(i) || jsonb_build_object('schema',r.nspname,'table',r.relname,'definition',pg_get_indexdef(i.indexrelid),'constraint_backed',EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conindid=i.indexrelid))) ORDER BY r.nspname,r.relname,i.indexrelid),'[]') FROM pg_index i JOIN relations r ON r.oid=i.indrelid),
      'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'identity_arguments',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'config',p.proconfig,'security_definer',p.prosecdef) ORDER BY n.nspname,p.proname,p.oid),'[]') FROM pg_proc p JOIN namespaces n ON n.oid=p.pronamespace WHERE p.prokind IN ('f','p','w')),
      'triggers',(SELECT coalesce(jsonb_agg((to_jsonb(t) || jsonb_build_object('schema',r.nspname,'table',r.relname,'definition',pg_get_triggerdef(t.oid,true))) ORDER BY r.nspname,r.relname,t.tgname),'[]') FROM pg_trigger t JOIN relations r ON r.oid=t.tgrelid WHERE NOT t.tgisinternal),
      'views',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',r.nspname,'name',r.relname,'kind',r.relkind,'definition',pg_get_viewdef(r.oid,true),'owner',pg_get_userbyid(r.relowner),'acl',r.relacl,'options',r.reloptions) ORDER BY r.nspname,r.relname),'[]') FROM relations r WHERE r.relkind IN ('v','m')),
      'rules',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',r.nspname,'relation',r.relname,'name',w.rulename,'definition',pg_get_ruledef(w.oid,true)) ORDER BY r.nspname,r.relname,w.rulename),'[]') FROM pg_rewrite w JOIN relations r ON r.oid=w.ev_class),
      'types',(SELECT coalesce(jsonb_agg((to_jsonb(t) || jsonb_build_object('schema',n.nspname,'owner',pg_get_userbyid(t.typowner),'base_type',CASE WHEN t.typbasetype<>0 THEN format_type(t.typbasetype,t.typtypmod) END)) ORDER BY n.nspname,t.typname),'[]') FROM pg_type t JOIN namespaces n ON n.oid=t.typnamespace),
      'enum_labels',(SELECT coalesce(jsonb_agg((to_jsonb(e) || jsonb_build_object('schema',n.nspname,'type',t.typname)) ORDER BY n.nspname,t.typname,e.enumsortorder),'[]') FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN namespaces n ON n.oid=t.typnamespace),
      'sequences',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.schemaname,s.sequencename),'[]') FROM pg_sequences s JOIN namespaces n ON n.nspname=s.schemaname),
      'sequence_states',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.nspname,s.relname),'[]') FROM sequence_states s),
      'inheritance',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.inhrelid,i.inhseqno),'[]') FROM pg_inherits i JOIN relations r ON r.oid=i.inhrelid),
      'extensions',(SELECT coalesce(jsonb_agg((to_jsonb(e) || jsonb_build_object('schema',n.nspname,'owner',pg_get_userbyid(e.extowner))) ORDER BY e.extname),'[]') FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace),
      'descriptions',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.classoid,d.objoid,d.objsubid),'[]') FROM pg_description d WHERE (d.classoid='pg_class'::regclass AND d.objoid IN (SELECT oid FROM relations)) OR (d.classoid='pg_namespace'::regclass AND d.objoid IN (SELECT oid FROM namespaces))),
      'publications',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.pubname),'[]') FROM pg_publication p),
      'publication_relations',(SELECT coalesce(jsonb_agg((to_jsonb(p) || jsonb_build_object('schema',r.nspname,'table',r.relname)) ORDER BY p.prpubid,p.prrelid),'[]') FROM pg_publication_rel p JOIN relations r ON r.oid=p.prrelid),
      'publication_namespaces',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.pnpubid,p.pnnspid),'[]') FROM pg_publication_namespace p),
      'event_triggers',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.evtname),'[]') FROM pg_event_trigger t),
      'foreign_tables',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.ftrelid),'[]') FROM pg_foreign_table t),
      'foreign_servers',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.srvname),'[]') FROM pg_foreign_server s)
    ),
    'roles',jsonb_build_object(
      'roles',(SELECT jsonb_agg((to_jsonb(r)-'rolpassword') ORDER BY r.rolname) FROM pg_roles r),
      'memberships',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member),'[]') FROM pg_auth_members m),
      'default_privileges',(SELECT coalesce(jsonb_agg((to_jsonb(d) || jsonb_build_object('role',pg_get_userbyid(d.defaclrole),'schema',n.nspname)) ORDER BY d.defaclrole,d.defaclnamespace,d.defaclobjtype),'[]') FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace),
      'database_role_settings',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.setdatabase,s.setrole),'[]') FROM pg_db_role_setting s),
      'database_acl',(SELECT jsonb_build_object('owner',pg_get_userbyid(d.datdba),'acl',d.datacl,'encoding',pg_encoding_to_char(d.encoding),'collate',d.datcollate,'ctype',d.datctype) FROM pg_database d WHERE d.datname=current_database()),
      'table_grants',(SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.table_schema,g.table_name,g.grantee,g.privilege_type),'[]') FROM information_schema.table_privileges g JOIN namespaces n ON n.nspname=g.table_schema),
      'column_grants',(SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.table_schema,g.table_name,g.column_name,g.grantee,g.privilege_type),'[]') FROM information_schema.column_privileges g JOIN namespaces n ON n.nspname=g.table_schema)
    ),
    'rls',(SELECT coalesce(jsonb_agg((to_jsonb(p) || jsonb_build_object('schema',r.nspname,'table',r.relname,'roles',ARRAY(SELECT pg_get_userbyid(role_oid) FROM unnest(p.polroles) role_oid),'using_expression',pg_get_expr(p.polqual,p.polrelid),'check_expression',pg_get_expr(p.polwithcheck,p.polrelid))) ORDER BY r.nspname,r.relname,p.polname),'[]') FROM pg_policy p JOIN relations r ON r.oid=p.polrelid),
    'data',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',t.nspname,'table',t.relname,'readable',t.readable,'count',jsonb_array_length(t.rows),'rows',t.rows) ORDER BY t.nspname,t.relname),'[]') FROM data_tables t),
    'inaccessible_tables',(SELECT coalesce(jsonb_agg(format('%I.%I',t.nspname,t.relname) ORDER BY t.nspname,t.relname),'[]') FROM data_tables t WHERE NOT t.readable),
    'inaccessible_sequences',(SELECT coalesce(jsonb_agg(format('%I.%I',s.nspname,s.relname) ORDER BY s.nspname,s.relname),'[]') FROM sequence_states s WHERE NOT s.readable),
    'storage_inventory',jsonb_build_object('buckets',(SELECT count(*) FROM storage.buckets),'objects',(SELECT count(*) FROM storage.objects),'object_bytes_included',false)
  ) AS document
), payload AS MATERIALIZED (SELECT document::text AS body FROM snapshot)
SELECT encode(convert_to(body,'UTF8'),'base64') AS backup_payload_base64,
  encode(sha256(convert_to(body,'UTF8')),'hex') AS payload_sha256,
  octet_length(body) AS payload_bytes
FROM payload;
