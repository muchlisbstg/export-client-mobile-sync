data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "ubuntu_2404" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_vpc" "staging" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-schema-runner-vpc"
  }
}

resource "aws_internet_gateway" "staging" {
  vpc_id = aws_vpc.staging.id

  tags = {
    Name = "${var.project_name}-schema-runner-igw"
  }
}

resource "aws_subnet" "runner" {
  vpc_id                  = aws_vpc.staging.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-schema-runner-subnet"
  }
}

resource "aws_route_table" "runner" {
  vpc_id = aws_vpc.staging.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.staging.id
  }

  tags = {
    Name = "${var.project_name}-schema-runner-rt"
  }
}

resource "aws_route_table_association" "runner" {
  subnet_id      = aws_subnet.runner.id
  route_table_id = aws_route_table.runner.id
}

resource "aws_security_group" "runner" {
  name        = "${var.project_name}-schema-runner"
  description = "No inbound access. Outbound-only connectivity for AWS Systems Manager and approved staging endpoints."
  vpc_id      = aws_vpc.staging.id

  # Deliberately no ingress rules: no SSH, RDP, HTTP, or application listener.
  egress {
    description = "Outbound HTTPS and package/database connectivity; destination restrictions are enforced by host policy and approved endpoint configuration."
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-schema-runner-sg"
  }
}

resource "aws_iam_role" "runner" {
  name = "${var.project_name}-schema-runner-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.runner.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "runner" {
  name = "${var.project_name}-schema-runner-profile"
  role = aws_iam_role.runner.name
}

resource "aws_instance" "runner" {
  count = var.enable_instance ? 1 : 0

  ami                         = data.aws_ami.ubuntu_2404.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.runner.id
  vpc_security_group_ids      = [aws_security_group.runner.id]
  iam_instance_profile        = aws_iam_instance_profile.runner.name
  associate_public_ip_address = true

  user_data                   = file("${path.module}/user-data.sh")
  user_data_replace_on_change = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "disabled"
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size_gib
    encrypted             = true
    delete_on_termination = true
  }

  monitoring = true

  tags = {
    Name = "${var.project_name}-schema-runner"
  }

  lifecycle {
    precondition {
      condition     = var.enable_instance
      error_message = "Instance creation is disabled. Explicitly set enable_instance=true only after budget and deployment approvals."
    }
  }

  depends_on = [aws_iam_role_policy_attachment.ssm_core]
}
