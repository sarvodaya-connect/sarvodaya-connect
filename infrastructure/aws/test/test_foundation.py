"""Offline safety assertions on the actual deployment templates (PyYAML via cfn-lint)."""
from pathlib import Path
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

class FoundationSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = (ROOT / 'foundation.yaml').read_text()
        rendered = subprocess.check_output([sys.executable, str(ROOT / 'render-foundation.py')], text=True)
        cls.template = yaml.load(rendered, Loader=TemplateLoader)
        cls.resources = cls.template['Resources']

    def test_render_embeds_exact_handler(self):
        self.assertEqual(self.resources['ParameterFunction']['Properties']['Code']['ZipFile'].rstrip(),
                         (ROOT / 'secure-parameters.cjs').read_text().rstrip())

    def test_region_and_account_rules(self):
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
        self.assertEqual(self.resources['Database']['DependsOn'], 'SecureParameters')
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

    def test_ssm_role_scoped_and_no_secret_outputs(self):
        role = self.resources['ParameterRole']['Properties']
        trust = role['AssumeRolePolicyDocument']['Statement'][0]
        self.assertEqual(trust['Principal'], {'Service': 'lambda.amazonaws.com'})
        access = role['Policies'][0]['PolicyDocument']['Statement'][0]
        self.assertNotIn('ssm:GetParametersByPath', access['Action'])
        arns = [value['Sub'] for value in access['Resource']]
        self.assertEqual(len(arns), 2)
        for arn in arns:
            self.assertIn(':parameter/sarvodaya-connect/test/', arn)
            self.assertNotIn('*', arn)
        self.assertEqual(self.resources['SecureParameters']['DeletionPolicy'], 'Retain')
        for name in self.template['Outputs']:
            self.assertNotIn('password', name.lower())
            self.assertNotIn('key', name.lower())

if __name__ == '__main__':
    unittest.main()
