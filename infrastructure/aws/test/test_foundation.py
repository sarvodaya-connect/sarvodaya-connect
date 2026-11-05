"""Offline safety assertions on the actual deployment templates (PyYAML via cfn-lint)."""
from pathlib import Path
import re
import subprocess
import sys
import unittest
import yaml

ROOT = Path(__file__).resolve().parent

class TemplateLoader(yaml.SafeLoader):
    pass

def intrinsic(loader, tag, node):
    if isinstance(node, yaml.ScalarNode):
        value = loader.construct_scalar(node)
    elif isinstance(node, yaml.SequenceNode):
        value = loader.construct_sequence(node)
    else:
        value = loader.construct_mapping(node)
    return {tag: value}

TemplateLoader.add_multi_constructor('!', intrinsic)

class SarvoAiGuardrails(unittest.TestCase):
    """The API template keeps SarvoAI off by default and fictional-only in TEST."""

    @classmethod
    def setUpClass(cls):
        cls.template = yaml.load((ROOT.parent / 'template.yaml').read_text(), Loader=TemplateLoader)
        cls.env = cls.template['Resources']['ApiFunction']['Properties']['Environment']['Variables']

    def test_off_by_default(self):
        self.assertEqual(self.template['Parameters']['SarvoAiEnabled']['Default'], 'false')
        self.assertEqual(self.template['Parameters']['SarvoAiPricingApproval']['Default'], '')
        self.assertEqual(self.env['SARVOAI_ENABLED'], {'Ref': 'SarvoAiEnabled'})

    def test_enabling_requires_a_pricing_approval(self):
        rule = self.template['Rules']['AiPricingApproved']
        self.assertNotIn('RuleCondition', rule)
        self.assertEqual(rule['Assertions'][0]['Assert'], {'Or': [
            {'Equals': [{'Ref': 'SarvoAiEnabled'}, 'false']},
            {'Not': [{'Equals': [{'Ref': 'SarvoAiPricingApproval'}, '']}]},
        ]})

    def test_obsolete_test_disable_rule_removed(self):
        self.assertNotIn('TestAiDisabled', self.template['Rules'])

    def test_test_stage_is_fictional_only(self):
        self.assertEqual(self.env['SARVOAI_FICTIONAL_ONLY'], {'If': ['IsTest', 'true', 'false']})
        self.assertEqual(self.template['Conditions']['IsTest'], {'Equals': [{'Ref': 'Stage'}, 'test']})

    def test_model_permission_only_when_enabled(self):
        policies = self.template['Resources']['ApiFunction']['Properties']['Policies']
        bedrock = [p for p in policies if isinstance(p, dict) and 'bedrock' in str(p)]
        self.assertEqual(len(bedrock), 1)
        self.assertEqual(bedrock[0]['If'][0], 'SarvoAiOn')
        self.assertEqual(bedrock[0]['If'][2], {'Ref': 'AWS::NoValue'})
        actions = {s['Action'] for s in bedrock[0]['If'][1]['Statement']}
        self.assertEqual(actions, {'bedrock:InvokeModel'})

class FoundationSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = (ROOT / 'foundation.yaml').read_text()
        rendered = subprocess.check_output([sys.executable, str(ROOT / 'render-foundation.py')], text=True)
        cls.template = yaml.load(rendered, Loader=TemplateLoader)
        cls.resources = cls.template['Resources']
        rendered_bootstrap = subprocess.check_output([sys.executable, str(ROOT / 'render-foundation.py'), '--bootstrap'], text=True)
        cls.bootstrap = yaml.load(rendered_bootstrap, Loader=TemplateLoader)
        cls.bootstrap_resources = cls.bootstrap['Resources']

    def test_render_embeds_exact_handler(self):
        self.assertEqual(self.bootstrap_resources['ParameterFunction']['Properties']['Code']['ZipFile'].rstrip(),
                         (ROOT / 'secure-parameters.cjs').read_text().rstrip())

    def test_bootstrap_has_no_dynamic_secret_prerequisite_or_application_resources(self):
        text = (ROOT / 'bootstrap.yaml').read_text()
        self.assertNotIn('{{resolve:ssm-secure:', text)
        self.assertEqual({r['Type'] for r in self.bootstrap_resources.values()}, {
            'AWS::IAM::Role', 'AWS::Logs::LogGroup', 'AWS::Lambda::Function',
            'Custom::SarvodayaTestParameters',
        })
        output = self.bootstrap['Outputs']['ConfigurationNamespace']
        self.assertEqual(output['Value'], '/sarvodaya-connect/test')
        self.assertEqual(output['Export']['Name'], {'Sub': '${AWS::StackName}-ConfigurationNamespace'})
        self.assertNotIn('ParameterFunction', self.resources)
        self.assertNotIn('ParameterRole', self.resources)

    def test_region_and_account_rules(self):
        self.assertEqual(self.template['Rules'], self.bootstrap['Rules'])
        rules = self.template['Rules']
        self.assertEqual(rules['SingaporeOnly']['Assertions'][0]['Assert'],
                         {'Equals': [{'Ref': 'AWS::Region'}, 'ap-southeast-1']})
        self.assertEqual(rules['ExistingAccountOnly']['Assertions'][0]['Assert'],
                         {'Equals': [{'Ref': 'AWS::AccountId'}, {'Ref': 'ExpectedAccountId'}]})

    def test_private_encrypted_low_cost_database(self):
        db = self.resources['Database']['Properties']
        for name, expected in {'PubliclyAccessible': False, 'MultiAZ': False, 'StorageEncrypted': True,
                               'DeletionProtection': True, 'BackupRetentionPeriod': 7,
                               'DBInstanceClass': 'db.t4g.micro', 'AllocatedStorage': '20',
                               'EngineVersion': '17.11', 'StorageType': 'gp3'}.items():
            self.assertEqual(db[name], expected, name)
        self.assertNotIn('SecureParameters', self.resources)
        password = db['MasterUserPassword']['Sub']
        self.assertEqual(password[0], '{{resolve:ssm-secure:${Namespace}/database-master-password:1}}')
        self.assertEqual(password[1], {'Namespace': {'ImportValue': 'sarvodaya-connect-test-bootstrap-ConfigurationNamespace'}})
        self.assertEqual(self.resources['Database']['DeletionPolicy'], 'Snapshot')

    def test_no_duplicate_budget_or_unapproved_paid_products(self):
        types = {resource['Type'] for resource in self.resources.values()}
        for forbidden in ['AWS::Budgets::Budget', 'AWS::EC2::NatGateway', 'AWS::RDS::DBProxy',
                          'AWS::SQS::Queue', 'AWS::IAM::User', 'AWS::IAM::AccessKey']:
            self.assertNotIn(forbidden, types)

    def test_buckets_private_encrypted_https_retained(self):
        for name in ['Documents', 'Artifacts']:
            bucket = self.resources[name]
            self.assertEqual(bucket['DeletionPolicy'], 'Retain')
            self.assertTrue(all(bucket['Properties']['PublicAccessBlockConfiguration'].values()))
            self.assertIn('BucketEncryption', bucket['Properties'])
            statement = self.resources[name + 'Https']['Properties']['PolicyDocument']['Statement'][0]
            self.assertEqual(statement['Effect'], 'Deny')
            self.assertEqual(statement['Condition']['Bool']['aws:SecureTransport'], 'false')
        cors = self.resources['Documents']['Properties']['CorsConfiguration']['If'][1]['CorsRules'][0]
        self.assertEqual(cors['AllowedOrigins'], [{'Ref': 'DashboardOrigin'}])
        self.assertIn('x-amz-checksum-sha256', cors['AllowedHeaders'])

    def test_cognito_admin_only_public_clients_no_users(self):
        pool = self.resources['UserPool']['Properties']
        self.assertTrue(pool['AdminCreateUserConfig']['AllowAdminCreateUserOnly'])
        self.assertEqual(pool['DeletionProtection'], 'ACTIVE')
        for name in ['DashboardClient', 'MobileClient']:
            client = self.resources[name]['Properties']
            self.assertFalse(client['GenerateSecret'])
            self.assertIn('ALLOW_USER_PASSWORD_AUTH', client['ExplicitAuthFlows'])
        self.assertNotIn('AWS::Cognito::UserPoolUser', {r['Type'] for r in self.resources.values()})

    def test_nat_bootstrap_signal_and_no_ssh_or_keys(self):
        nat = self.resources['NatInstance']
        self.assertEqual(nat['Properties']['InstanceType'], 't4g.nano')
        self.assertEqual(nat['Properties']['CreditSpecification']['CPUCredits'], 'standard')
        self.assertEqual(nat['Properties']['MetadataOptions']['HttpTokens'], 'required')
        self.assertNotIn('KeyName', nat['Properties'])
        self.assertNotIn('IamInstanceProfile', nat['Properties'])
        self.assertEqual(nat['CreationPolicy']['ResourceSignal']['Timeout'], 'PT10M')
        script = nat['Properties']['UserData']['Fn::Base64']['Sub']
        self.assertIn('cfn-signal', script)
        self.assertIn('iptables -F FORWARD', script)
        self.assertIn('service iptables save', script)
        self.assertFalse(nat['Properties']['SourceDestCheck'])
        for rule in self.resources['NatSecurityGroup']['Properties']['SecurityGroupIngress']:
            self.assertIn(rule['FromPort'], [80, 443])

    def test_disk_swap_is_enabled_before_packages_and_persists(self):
        nat = self.resources['NatInstance']['Properties']
        script = nat['UserData']['Fn::Base64']['Sub']
        commands = [
            'dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none',
            'chmod 600 /swapfile', 'mkswap /swapfile', 'swapon /swapfile',
            "echo '/swapfile none swap sw 0 0' >> /etc/fstab",
            'dnf --setopt=install_weak_deps=False install -y aws-cfn-bootstrap iptables-services',
        ]
        offsets = [script.index(command) for command in commands]
        self.assertEqual(offsets, sorted(offsets))
        disk = nat['BlockDeviceMappings'][0]['Ebs']
        self.assertTrue(disk['Encrypted'])
        self.assertEqual(disk['VolumeSize'], 8)
        self.assertEqual(nat['InstanceType'], 't4g.nano')

    def test_database_waits_for_nat_creation_policy(self):
        self.assertEqual(self.resources['Database']['DependsOn'], 'NatInstance')
        self.assertEqual(self.resources['NatInstance']['CreationPolicy']['ResourceSignal']['Count'], 1)
        self.assertEqual(self.resources['Database']['DeletionPolicy'], 'Snapshot')
        self.assertTrue(self.resources['Database']['Properties']['DeletionProtection'])

    def test_nat_startup_script_has_valid_bash_syntax(self):
        script = self.resources['NatInstance']['Properties']['UserData']['Fn::Base64']['Sub']
        subprocess.run(['bash', '-n'], input=script, text=True, check=True)

    def test_recovery_import_has_only_identical_retained_bucket_and_pool_definitions(self):
        rendered = subprocess.check_output([sys.executable, str(ROOT / 'render-foundation.py'), '--retained-import'], text=True)
        template = yaml.load(rendered, Loader=TemplateLoader)
        self.assertEqual(set(template['Resources']), {'Documents', 'Artifacts', 'UserPool'})
        for name, resource in template['Resources'].items():
            self.assertEqual(resource, self.resources[name])
            self.assertEqual(resource['DeletionPolicy'], 'Retain')
        self.assertEqual(template['Rules'], self.template['Rules'])
        self.assertNotIn('NatImage', template['Parameters'])
        self.assertNotIn('Outputs', template)
        self.assertNotIn('ssm-secure', rendered)

    def test_ssm_role_scoped_and_no_secret_outputs(self):
        role = self.bootstrap_resources['ParameterRole']['Properties']
        trust = role['AssumeRolePolicyDocument']['Statement'][0]
        self.assertEqual(trust['Principal'], {'Service': 'lambda.amazonaws.com'})
        access = role['Policies'][0]['PolicyDocument']['Statement'][0]
        self.assertNotIn('ssm:GetParametersByPath', access['Action'])
        arns = [value['Sub'] for value in access['Resource']]
        self.assertEqual(len(arns), 2)
        for arn in arns:
            self.assertIn(':parameter/sarvodaya-connect/test/', arn)
            self.assertNotIn('*', arn)
        self.assertEqual(self.bootstrap_resources['SecureParameters']['DeletionPolicy'], 'Retain')
        for name in [*self.template['Outputs'], *self.bootstrap['Outputs']]:
            self.assertNotIn('password', name.lower())
            self.assertNotIn('key', name.lower())

class ApiCapacityBudget(unittest.TestCase):
    """The limits in docs/aws-test-environment.md live in three places and must agree."""

    TESTERS = 2

    @classmethod
    def setUpClass(cls):
        repo = ROOT.parents[2]
        template = yaml.load((ROOT.parent / 'template.yaml').read_text(), Loader=TemplateLoader)
        function = template['Resources']['ApiFunction']['Properties']
        cls.concurrency = function['ReservedConcurrentExecutions']['If'][1]
        cls.pool = int(function['Environment']['Variables']['DATABASE_CONNECTION_LIMIT']['If'][1])
        cls.role_limit = int(re.search(
            r'ALTER ROLE sc_test_app CONNECTION LIMIT (\d+);',
            (ROOT / 'runtime-database-role.sql').read_text(),
        ).group(1))
        cls.read_slots = int(re.search(
            r'READ_SLOTS_PER_RENDER = (\d+);',
            (repo / 'apps/dashboard/src/lib/platform-read.ts').read_text(),
        ).group(1))

    def test_two_testers_stay_within_lambda_concurrency(self):
        self.assertLessEqual(self.TESTERS * self.read_slots, self.concurrency)

    def test_database_role_covers_a_deployment_with_room_to_operate(self):
        # Old and new Lambda instances can both hold connections during a deployment.
        self.assertGreaterEqual(self.role_limit, 2 * self.concurrency * self.pool + 2)

    def test_test_capacity_stays_small(self):
        self.assertEqual(self.pool, 1)
        self.assertLessEqual(self.concurrency, 4)
        self.assertLessEqual(self.role_limit, 10)

if __name__ == '__main__':
    unittest.main()
